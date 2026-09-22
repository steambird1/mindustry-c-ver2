p = '/data/workspace/src/mindcOptimizer.js'
s = open(p, encoding='utf-8').read()

# ---- 1. no longer refuse inlining for handle parameters ----
old = '''		/*
		A parameter that receives an array HANDLE cannot be inlined: the handle
		is delivered by real `set` instructions at the call site, and inlining
		removes the call -- leaving the parameter's registers unset, so the
		function would jump to line 0. Such a function has to stay a real call.
		*/
		const hasHandleParameter = (funcNode.parameters ?? []).some(param => {
			const symbol = funcNode.scope?.lookupCurrent?.(param.name)
				?? funcNode.scope?.lookup?.(param.name) ?? null;
			return symbol?.arrayParamRep === 'handle';
		});
		if (analyzedBody && hasHandleParameter) {
			this.functionInfo.get(funcName).canInline = false;
		}
		if (analyzedBody && !hasHandleParameter) {
			if (!this.functionInfo.get(funcName).isAddressed) {'''
new = '''		if (analyzedBody) {
			if (!this.functionInfo.get(funcName).isAddressed) {'''
assert s.count(old) == 1, s.count(old)
s = s.replace(old, new, 1)

# ---- 2. resolve the array an inlined argument really means ----
anchor = '''	inlineFunctionAtSite(funcNode, callNode, parentNode, context) {'''
assert s.count(anchor) == 1
helper = '''	/**
	 * The array an argument handed to an inlined parameter really means.
	 *
	 * Inlining does not deliver arguments into parameter slots -- it rebinds
	 * the parameter to the argument's own storage. For an array that has no
	 * address, "rebinding" can only mean: USE THE ARGUMENT'S OWN REGISTERS.
	 * Anything else (making the parameter a fresh array of its own) copies it,
	 * and a write inside the function then lands in the copy and is lost.
	 *
	 * @param {any} argNode The argument at this call site
	 * @returns {import('./mindcSemantic.js').SymbolEntry?} null when the
	 *          argument is not a plain array name, so nothing can be aliased
	 */
	arrayArgumentSymbolOf(argNode) {
		if (!argNode || argNode.type !== 'Identifier') return null;
		const symbol = argNode.symbol ?? null;
		if (symbol && symbol.myType?.()?.kind === 'array') return symbol;
		const scope = argNode.scope ?? this.currentScope ?? null;
		const found = scope?.lookup?.(argNode.name) ?? null;
		if (found && found.myType?.()?.kind === 'array') return found;
		return null;
	}

	/**
	 * Whether this call may be inlined given the arrays it hands over.
	 *
	 * @param {any} funcNode
	 * @param {any} callNode
	 * @returns {boolean}
	 */
	canInlineArrayArguments(funcNode, callNode) {
		const params = funcNode.parameters ?? [];
		for (let i = 0; i < params.length; i++) {
			const arg = (callNode.arguments ?? [])[i];
			if (!arg) continue;
			const type = arg.dataType ?? null;
			if (!type || type.kind !== 'array') continue;
			if (this.arrayArgumentSymbolOf(arg)) continue;
			/*
			Not a plain array name -- there is nothing to alias to, so the
			parameter would have to become an array of its own. Keep the real
			call instead, which passes a handle and stays correct.
			*/
			return false;
		}
		return true;
	}

''' + anchor
s = s.replace(anchor, helper, 1)

old = '''	inlineFunctionAtSite(funcNode, callNode, parentNode, context) {
		// Cloned body must be a compound statement
		// 检查是否适合内联
		if (!this.isSuitableForInlining(funcNode, callNode, context)) {
			return false;
		}'''
assert s.count(old) == 1
new = '''	inlineFunctionAtSite(funcNode, callNode, parentNode, context) {
		// Cloned body must be a compound statement
		// 检查是否适合内联
		if (!this.isSuitableForInlining(funcNode, callNode, context)) {
			return false;
		}
		/*
		An array argument has to be aliasable, or inlining would hand the
		function a COPY of it (see `arrayArgumentSymbolOf`).
		*/
		if (!this.canInlineArrayArguments(funcNode, callNode)) return false;'''
s = s.replace(old, new, 1)

# ---- 3. mark the alias symbol so the generator uses the caller's array ----
old = '''					if (ziel) {
						// TODO: Add new symbol into caller's symbol table!
						this.duplicateVariable(funcNode.scope, param.name, ziel, symbolName);
						const symbolTarget = ziel.lookupCurrent(symbolName);
						symbolTarget.kind = 'variable';	// Don't be 'parameter'!
					}'''
assert s.count(old) == 1, s.count(old)
new = '''					if (ziel) {
						// TODO: Add new symbol into caller's symbol table!
						this.duplicateVariable(funcNode.scope, param.name, ziel, symbolName);
						const symbolTarget = ziel.lookupCurrent(symbolName);
						symbolTarget.kind = 'variable';	// Don't be 'parameter'!
						/*
						An array parameter is an ALIAS, not an array of its own:
						point it at the caller's array so that a write inside the
						inlined body really lands there. Without this the
						parameter gets a fresh layout and the write is lost.
						*/
						const aliased = this.arrayArgumentSymbolOf(callNode.arguments[index]);
						if (aliased) {
							symbolTarget.arrayAliasOf = aliased;
							// It is no longer a slot that gets a handle delivered
							symbolTarget.arrayParamRep = null;
						}
					}'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('optimizer patched (inline aliasing)')

# ---- 4. generator: the alias uses the caller's array ----
p2 = '/data/workspace/src/mindcGenerator.js'
t = open(p2, encoding='utf-8').read()
old = '''	arrayViewOf(symbol) {
		const glob = this.glob;
		const type = symbol?.myType?.() ?? null;
		if (!type || type.kind !== 'array') return null;'''
assert t.count(old) == 1, t.count(old)
new = '''	arrayViewOf(symbol) {
		const glob = this.glob;
		/*
		An inlined parameter: the array IS the caller's array. Delegating is
		what keeps the inlined body writing into it -- and what lets a
		non-memory array be inlined at all, since an alias has no layout of
		its own to fall back on.
		*/
		if (symbol?.arrayAliasOf) return this.arrayViewOf(symbol.arrayAliasOf);
		const type = symbol?.myType?.() ?? null;
		if (!type || type.kind !== 'array') return null;'''
t = t.replace(old, new, 1)

old = '''	arrayRetFor(symbol, pointer) {
		const glob = this.glob;
		/*
		A parameter holding NAMES instead of an address.'''
assert t.count(old) == 1
new = '''	arrayRetFor(symbol, pointer) {
		const glob = this.glob;
		/*
		An inlined parameter is the caller's array, not an array of its own.
		This has to be checked before anything that would give the parameter a
		representation of its own (a handle, or a fresh register layout).
		*/
		if (symbol?.arrayAliasOf) return this.arrayViewOf(symbol.arrayAliasOf);
		/*
		A parameter holding NAMES instead of an address.'''
t = t.replace(old, new, 1)

old = '''	arrayStyleFor(symbol) {
		/*'''
assert t.count(old) == 1
new = '''	arrayStyleFor(symbol) {
		/*
		An inlined parameter has no style of its own: it borrows the caller's.
		*/
		if (symbol?.arrayAliasOf) return this.arrayStyleFor(symbol.arrayAliasOf);
		/*'''
t = t.replace(old, new, 1)
open(p2, 'w', encoding='utf-8').write(t)
print('generator patched (alias delegation)')
