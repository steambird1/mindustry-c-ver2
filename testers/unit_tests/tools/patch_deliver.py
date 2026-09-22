p = '/data/workspace/src/mindcGenerator.js'
s = open(p, encoding='utf-8').read()

# ---- import TraditionalArrayRet ----
old = '''	NameArrayRet, ArrayHandleRet, ensureArrayHandle, arrayLengthOfType, componentCountOf, isFlatComponentType, CATEGORY_ALIASES, Globals, VariableRet, ImmediateRet, BasicRet, IntRet, BoolRet, FloatRet, ContentRet,'''
assert s.count(old) == 1
s = s.replace(old, '''	NameArrayRet, ArrayHandleRet, ensureArrayHandle, arrayLengthOfType, componentCountOf, isFlatComponentType, CATEGORY_ALIASES, Globals, VariableRet, ImmediateRet, BasicRet, IntRet, BoolRet, FloatRet, ContentRet,
	TraditionalArrayRet,''', 1)

# ---- rewrite the array-argument dispatch ----
old = '''		const representation = paramSymbol?.arrayParamRep ?? null;
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
				/*
				The callee is not known here, so nothing can tell it that its
				parameter arrived as a handle -- and without that it would read
				the handle as a block/offset pair. Say so instead of emitting
				code that silently breaks. (Function overloading, once it
				exists, is what removes this restriction: the parameter's
				representation then comes from the declared type.)
				*/
				throw new InternalGenerationFailure(
					`Array '${argNode.name}' is not laid out in memory, so it cannot be handed `
					+ `to a function pointer yet: call the function directly, or give the `
					+ `array a memory layout`, argNode.location);
			}
		}'''
assert s.count(old) == 1
new = '''		const representation = paramSymbol?.arrayParamRep ?? null;
		const argSymbol = (argNode && argNode.type === 'Identifier')
			? (this.currentScope?.lookup?.(argNode.name)
				?? this.semantic?.globalScope?.lookup?.(argNode.name) ?? null)
			: null;
		const argIsArray = !!argSymbol && argSymbol.myType?.()?.kind === 'array';
		/*
		How an array travels is decided by the SLOT it goes into, not by the call
		site -- an indirect call has no call-site information at all, since the
		callee is a register holding a line number:
		  - a parameter marked `handle` / `remote` / `names`, or one whose type is
		    declared `remote`, takes a HANDLE (two helper entry points). That is
		    the only form an array without an address can travel as, and it is
		    also accepted from a memory array;
		  - anything else takes a POINTER.
		*/
		const slotWantsHandle = !!slotType && (slotType.qualifiers ?? []).includes('remote');
		const wantsHandle = argIsArray && !!slotType && slotType.kind === 'array'
			&& (representation === 'handle' || representation === 'remote'
				|| representation === 'names' || (!paramSymbol && slotWantsHandle));
		if (wantsHandle) {
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
		/*
		An indirect call whose slot expects a POINTER: a memory array has one, so
		it falls through to the ordinary delivery below. One that does not cannot
		be turned into an address, and the fixed `__param_N` slots cannot carry a
		per-element description either -- say so instead of emitting code that
		silently reads a block/offset pair nobody assigned.
		*/
		if (!paramSymbol && argIsArray && !!slotType && slotType.kind === 'array'
			&& !(this.arrayViewOf(argSymbol) instanceof TraditionalArrayRet)) {
			throw new InternalGenerationFailure(
				`Array '${argNode.name}' has no address, so it cannot be handed to a `
				+ `function pointer whose parameter is an ordinary array: declare that `
				+ `parameter 'remote' (it then travels as a handle), or give the array a `
				+ `memory layout`, argNode.location);
		}'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('array arguments are now dispatched by the slot they go into')
