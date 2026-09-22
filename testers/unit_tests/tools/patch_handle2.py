p = '/data/workspace/src/mindcGenerator.js'
s = open(p, encoding='utf-8').read()

# ---- imports ----
old = "\tNameArrayRet,"
assert s.count(old) == 1
s = s.replace(old, "\tNameArrayRet, ArrayHandleRet, ensureArrayHandle,", 1)

# ---- arrayStyleFor: a handle parameter is not a memory array ----
old = '''		if (symbol?.arrayParamRep === 'remote' || symbol?.arrayParamRep === 'names') {
			return { type: 'embedded', implement: 'divided', reason: 'array parameter' };
		}'''
assert s.count(old) == 1, s.count(old)
new = '''		if (symbol?.arrayParamRep === 'handle' || symbol?.arrayParamRep === 'remote'
			|| symbol?.arrayParamRep === 'names') {
			return { type: 'embedded', implement: 'divided', reason: 'array parameter' };
		}'''
s = s.replace(old, new, 1)

# ---- arrayRetFor: the parameter IS the handle ----
old = '''		if (symbol?.arrayParamRep === 'remote' || symbol?.arrayParamRep === 'names') {
			const length = this.arrayLengthOf(symbol);
			return new NameArrayRet(glob, symbol.getAssemblySymbol(), symbol.myType(), length,
				symbol.arrayParamRep === 'remote'
					? remoteDeviceRegOf(symbol.getAssemblySymbol()) : null);
		}'''
assert s.count(old) == 1, s.count(old)
new = '''		if (symbol?.arrayParamRep === 'handle' || symbol?.arrayParamRep === 'remote'
			|| symbol?.arrayParamRep === 'names') {
			/*
			The parameter holds a HANDLE: two registers with the entry points of
			the get / set helpers of the array it was handed. No device register
			is needed -- the helper was built for the caller's array and already
			knows which processor to talk to.
			*/
			const length = this.arrayLengthOf(symbol) || 0;
			return new ArrayHandleRet(glob, symbol.getAssemblySymbol(), symbol.myType(), length);
		}'''
s = s.replace(old, new, 1)

# ---- deliverArgument: hand over the handle ----
old = '''		const representation = paramSymbol?.arrayParamRep ?? null;
		if ((representation === 'remote' || representation === 'names')
			&& argNode && argNode.type === 'Identifier') {
			const argSymbol = this.currentScope?.lookup?.(argNode.name)
				?? this.semantic?.globalScope?.lookup?.(argNode.name) ?? null;
			if (argSymbol && argSymbol.myType?.()?.kind === 'array') {
				const array = this.arrayViewOf(argSymbol);
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
assert s.count(old) == 1, s.count(old)
new = '''		const representation = paramSymbol?.arrayParamRep ?? null;
		if ((representation === 'handle' || representation === 'remote' || representation === 'names')
			&& argNode && argNode.type === 'Identifier') {
			const argSymbol = this.currentScope?.lookup?.(argNode.name)
				?? this.semantic?.globalScope?.lookup?.(argNode.name) ?? null;
			if (argSymbol && argSymbol.myType?.()?.kind === 'array') {
				const array = this.arrayViewOf(argSymbol);
				const handle = array ? ensureArrayHandle(glob, array) : null;
				if (!handle) {
					throw new InternalGenerationFailure(
						`Array '${argNode.name}' cannot be handed to a function: `
						+ `it has no representation that travels as a value`, argNode.location);
				}
				const length = arrayLengthOfType(slotType) || array.length || 0;
				const instructions = [value.instructions, handle.instructions,
					InstructionBuilder.set(`${slotName}_get`, handle.get)];
				if (handle.set) {
					instructions.push(InstructionBuilder.set(`${slotName}_set`, handle.set));
				}
				return new ArrayHandleRet(glob, slotName, slotType, length, instructions);
			}
		}
		/*
		An indirect call: the callee is not known here, so the parameter symbol
		is missing. A non-memory array still cannot be turned into a pointer --
		and the fixed `__param_N` slots cannot carry a per-element description --
		so it, too, has to travel as a handle.
		*/
		if (!paramSymbol && argNode && argNode.type === 'Identifier'
			&& slotType && slotType.kind === 'array') {
			const argSymbol = this.currentScope?.lookup?.(argNode.name)
				?? this.semantic?.globalScope?.lookup?.(argNode.name) ?? null;
			if (argSymbol && argSymbol.myType?.()?.kind === 'array'
				&& argSymbol.arrayParamRep !== 'traditional'
				&& !argSymbol.isTraditionalArray) {
				const array = this.arrayViewOf(argSymbol);
				const handle = array ? ensureArrayHandle(glob, array) : null;
				if (handle) {
					const instructions = [value.instructions, handle.instructions,
						InstructionBuilder.set(`${slotName}_get`, handle.get)];
					if (handle.set) {
						instructions.push(InstructionBuilder.set(`${slotName}_set`, handle.set));
					}
					return new ArrayHandleRet(glob, slotName, slotType, array.length || 0, instructions);
				}
			}
		}'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('generator wired for handles')
