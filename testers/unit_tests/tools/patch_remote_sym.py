p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- 1. helper: synthesise the target symbol ----
anchor = '''    /**
     * How many elements a lookup table can name, and their names.'''
assert s.count(anchor) == 1
helper = '''    /**
     * The symbol of a variable that `remote(dev, x)` names by IDENTIFIER.
     *
     * `x` need not be declared in this program at all -- the variable lives on
     * the other processor, and its name is all that is needed to reach it. But
     * a SYMBOL is what carries the rest of the description (the length of an
     * array, the layout its elements have), so behave as if a global `x` of the
     * type this declaration asks for had been declared, and take its symbol.
     *
     * It is deliberately NOT added to any scope: nothing is really defined
     * here, so no registers must be emitted for it and it must not be exported.
     *
     * @param {string} name
     * @param {TypeInfo} finalType The type the declaration asks for
     * @param {any} [location]
     * @returns {SymbolEntry}
     */
    synthesiseRemoteTarget(name, finalType, location = null) {
        this.remoteTargetCache ??= new Map();
        const key = `${this.globalScope?.getPath?.() ?? 'g:'}.${name}`;
        if (this.remoteTargetCache.has(key)) return this.remoteTargetCache.get(key);
        /*
        The variable over there is an ordinary one: `remote` describes how THIS
        program reaches it, not what it is.
        */
        let type = finalType;
        if (finalType && (finalType.qualifiers ?? []).includes('remote')) {
            type = Object.create(Object.getPrototypeOf(finalType));
            Object.assign(type, finalType);
            type.qualifiers = [...finalType.qualifiers].filter(q => q !== 'remote');
        }
        const symbol = new SymbolEntry(name, { type: type }, this.globalScope, 'variable', location);
        symbol.isGlobal = true;
        this.remoteTargetCache.set(key, symbol);
        return symbol;
    }

''' + anchor
s = s.replace(anchor, helper, 1)

# ---- 2. use it (and prefer a real declaration when one is visible) ----
old = '''		let targetSymbol = this.lookupSymbol?.(inner.name) ?? this.currentScope?.lookup?.(inner.name) ?? null;'''
assert s.count(old) == 1, s.count(old)
new = '''		let targetSymbol = this.lookupSymbol?.(inner.name) ?? this.currentScope?.lookup?.(inner.name) ?? null;
		/*
		A name visible in a NON-global scope is taken as it is -- but it is a
		local, whose register name depends on optimisations that differ between
		two processors, so reaching it from another processor is not reliable.
		*/
		if (targetSymbol && !targetSymbol.isGlobal && !selfDevice) {
			this.addWarning(`'${inner.name}' is a local: its register name depends on how this `
				+ `program is optimised, so another processor may not find it under that name. `
				+ `Declare it globally to reach it remotely`, location);
		}'''
s = s.replace(old, new, 1)

old = '''		if (!targetSymbol && inner.type === 'Identifier' && !selfDevice) {
			/*
			The variable lives on the OTHER processor, so all that is needed is
			its name -- declaring it here just to be able to name it would be
			pointless, and would also suggest that THIS program's variable is
			the one being used.
			*/
			symbol.remoteDevice = deviceNode;
			symbol.remoteName = `${this.globalScope.getPath()}.${inner.name}`;
			symbol.isRemote = true;
			if (layout) symbol.requestedArrayImplementation = layout;
			/*
			Without a declaration here the length is unknown, and an array
			cannot be reached element by element without it.
			*/
			if (finalType && finalType.kind === 'array') {
				const dims = this.arrayDimensionsOf(finalType);
				if (!dims.length || dims[0] === null) {
					this.addError(`'${inner.name}' is not declared here, so remote() cannot know `
						+ `how long the array on the other processor is: give the length, as in `
						+ `'remote int ru[5] = remote(processor1, ${inner.name})'`, location);
					declarator.initializer = null;
					return;
				}
			}
			declarator.initializer = null;
			return;
		}'''
assert s.count(old) == 1, s.count(old)
new = '''		if (!targetSymbol && inner.type === 'Identifier' && !selfDevice) {
			/*
			Only an array whose length is not written here has a reason to wait:
			a declaration further down may still supply it.
			*/
			const lengthUnknown = finalType && finalType.kind === 'array'
				&& (() => {
					const dims = this.arrayDimensionsOf(finalType);
					return !dims.length || dims[0] === null;
				})();
			if (lengthUnknown && !deferred) {
				/*
				Take the initializer away for now: it is a `remote(...)` call,
				and nothing here knows how to type-check one. It is put back when
				the binding is retried.
				*/
				(this.pendingRemoteLinks ??= []).push(
					{ declarator, symbol, finalType, qualifiers, initializer: declarator.initializer });
				declarator.initializer = null;
				return;
			}
			if (lengthUnknown) {
				this.addError(`'${inner.name}' is not declared here, so remote() cannot know how `
					+ `long the array on the other processor is: give the length, as in `
					+ `'remote int ru[5] = remote(processor1, ${inner.name})'`, location);
				declarator.initializer = null;
				return;
			}
			/*
			Not declared here -- so take the symbol a global `x` of this type
			would have. Nothing is defined by that; it is what carries the
			description of the variable over there.
			*/
			targetSymbol = this.synthesiseRemoteTarget(inner.name, finalType, location);
			if (layout) targetSymbol.requestedArrayImplementation = layout;
		}'''
s = s.replace(old, new, 1)

# ---- 3. the `deferred` flag ----
old = '''	consumeRemoteDirective(declarator, symbol, finalType, qualifiers = []) {'''
assert s.count(old) == 1
s = s.replace(old, '''	consumeRemoteDirective(declarator, symbol, finalType, qualifiers = [], deferred = false) {''', 1)

old = '''            entry.declarator.initializer = entry.initializer;
            this.consumeRemoteDirective(entry.declarator, entry.symbol, entry.finalType,
                entry.qualifiers);'''
assert s.count(old) == 1
new = '''            entry.declarator.initializer = entry.initializer;
            this.consumeRemoteDirective(entry.declarator, entry.symbol, entry.finalType,
                entry.qualifiers, true);'''
s = s.replace(old, new, 1)

# ---- 4. a leftover is no longer an error in itself ----
old = '''        for (const entry of (this.pendingRemoteLinks ?? [])) {
            this.addError(`The variable of remote() is not declared anywhere in this program`,
                entry.declarator?.location ?? null);
        }'''
assert s.count(old) == 1
new = '''        for (const entry of (this.pendingRemoteLinks ?? [])) {
            /*
            Retrying with `deferred` set resolves it against a global symbol of
            the required type -- which is enough unless the length of an array
            is still unknown, the one thing a name alone cannot supply.
            */
            entry.declarator.initializer = entry.initializer;
            this.consumeRemoteDirective(entry.declarator, entry.symbol, entry.finalType,
                entry.qualifiers, true);
        }'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('remote identifier now takes a (synthesised) global symbol')
