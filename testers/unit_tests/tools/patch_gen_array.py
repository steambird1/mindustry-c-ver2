p = '/data/workspace/src/mindcGenerator.js'
s = open(p, encoding='utf-8').read()

# ---- 1. import NameArrayRet ----
old = "RemoteStoredPointerRet, LookupArrayRet, NameStructPointerRet, NameStructDerefRet,\n\tRemoteStructPointerRet,"
assert s.count(old) == 1, s.count(old)
s = s.replace(old, old + "\n\tNameArrayRet,", 1)

# ---- 2. parameterSlot also returns the symbol ----
old = '''		const parameter = symbol.owningScope.lookupCurrent(functionType.parameters[index].name);
		return {
			name: parameter.getAssemblySymbol(),
			type: parameter.type.type
		};'''
assert s.count(old) == 1
s = s.replace(old, '''		const parameter = symbol.owningScope.lookupCurrent(functionType.parameters[index].name);
		return {
			name: parameter.getAssemblySymbol(),
			type: parameter.type.type,
			parameter
		};''', 1)

# ---- 3. deliverArgument gains the parameter symbol and the argument node ----
old = '''			result.concat(this.deliverArgument(slot.name, slot.type, value));'''
assert s.count(old) == 1
s = s.replace(old, '''			result.concat(this.deliverArgument(slot.name, slot.type, value,
				slot.parameter ?? null, argument));''', 1)

old = '''	deliverArgument(slotName, slotType, argument) {
		const glob = this.glob;
		// `get()` + `materialize()`: the argument ends up in a temporary symbol of
		// its own, so that evaluating the *next* argument (which may call a function,
		// possibly this very one) cannot clobber it.
		const value = argument.get().materialize();'''
assert s.count(old) == 1
new = '''	/**
	 * The name of element `index` of an array value, or the register holding it.
	 *
	 * @param {import('./mindcInfrastructure.js').ArrayRet} array
	 * @param {number} index
	 * @returns {{name: string, dynamic: boolean}?} null when the layout has no
	 *          such element name (an `encoded` array, say)
	 */
	arrayElementNameOf(array, index) {
		if (!array) return null;
		// The elements are registers of another processor, named `<array>_<i>`
		if (array instanceof RemoteArrayRet) {
			return { name: `${array.targetAssembly}_${index}`, dynamic: false };
		}
		// Named after content constants (`copper`, `lead`, ...) -- same everywhere
		if (array instanceof LookupArrayRet) {
			return { name: array.names?.[index] ?? null, dynamic: false };
		}
		// Already a by-name array: the name is itself in a register
		if (array instanceof NameArrayRet) {
			return { name: array.elementName(index), dynamic: true };
		}
		if (typeof array.elementName === 'function') {
			return { name: array.elementName(index), dynamic: false };
		}
		return null;
	}

	deliverArgument(slotName, slotType, argument, paramSymbol = null, argNode = null) {
		const glob = this.glob;
		// `get()` + `materialize()`: the argument ends up in a temporary symbol of
		// its own, so that evaluating the *next* argument (which may call a function,
		// possibly this very one) cannot clobber it.
		const value = argument.get().materialize();
		/*
		An array handed to a parameter that takes NAMES: store the NAME of every
		element (see NameArrayRet). This is what makes an access inside the
		function reach the CALLER's array rather than a copy -- and it is the only
		thing that CAN be handed over, because a non-memory array has no address.
		*/
		const representation = paramSymbol?.arrayParamRep ?? null;
		if ((representation === 'remote' || representation === 'names')
			&& argNode && argNode.type === 'Identifier') {
			const argSymbol = this.currentScope?.lookup?.(argNode.name)
				?? this.semantic?.globalScope?.lookup?.(argNode.name) ?? null;
			if (argSymbol && argSymbol.myType?.()?.kind === 'array') {
				const array = this.arrayRetFor(argSymbol, null);
				const length = arrayLengthOfType(slotType) || array.length || 0;
				const deviceReg = remoteDeviceRegOf(slotName);
				const instructions = [value.instructions];
				/*
				A remote array also needs the processor: that is what every
				`read` / `write` inside the function goes to.
				*/
				if (representation === 'remote' && array.deviceReg) {
					instructions.push(InstructionBuilder.set(deviceReg, array.deviceReg));
				}
				for (let i = 0; i < length; i++) {
					const info = this.arrayElementNameOf(array, i);
					if (!info || !info.name) continue;
					instructions.push(InstructionBuilder.set(`${slotName}_${i}`,
						info.dynamic ? info.name : `"${info.name}"`));
				}
				return new NameArrayRet(glob, slotName, slotType, length,
					representation === 'remote' ? deviceReg : null, instructions);
			}
		}'''
s = s.replace(old, new, 1)

# ---- 4. arrayStyleFor: a parameter keeps the layout it is given ----
old = '''	arrayStyleFor(symbol) {'''
assert s.count(old) == 1, s.count(old)
new = '''	arrayStyleFor(symbol) {
		/*
		A parameter that is handed a non-memory array has to keep that shape:
		the call site gives it names, not an address. Saying so here is also what
		stops the array from being given memory of its own, and what lets
		`arraySymbolOf` pick the by-name path instead of stepping a pointer.
		*/
		if (symbol?.arrayParamRep === 'remote' || symbol?.arrayParamRep === 'names') {
			return { type: 'embedded', implement: 'divided', reason: 'array parameter' };
		}'''
s = s.replace(old, new, 1)

# ---- 5. arrayRetFor: build the by-name view for such a parameter ----
old = '''	arrayRetFor(symbol, pointer) {
		const glob = this.glob;
		const style = this.arrayStyleFor(symbol);'''
assert s.count(old) == 1
new = '''	arrayRetFor(symbol, pointer) {
		const glob = this.glob;
		/*
		A parameter holding NAMES instead of an address. Every access goes
		through `read` / `write <device> <the name>`, which is the only way to
		reach an array that has no address -- and the only way that writes back
		into the caller's array.
		*/
		if (symbol?.arrayParamRep === 'remote' || symbol?.arrayParamRep === 'names') {
			const length = this.arrayLengthOf(symbol);
			return new NameArrayRet(glob, symbol.getAssemblySymbol(), symbol.myType(), length,
				symbol.arrayParamRep === 'remote'
					? remoteDeviceRegOf(symbol.getAssemblySymbol()) : null);
		}
		const style = this.arrayStyleFor(symbol);'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('generator patched')
