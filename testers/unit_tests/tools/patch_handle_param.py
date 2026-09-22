p = '/data/workspace/src/mindcGenerator.js'
s = open(p, encoding='utf-8').read()

# ---- 1. the prologue has to copy a handle as a handle ----
old = '''				const paramName = `__param_${paramId++}`;
				if ((sym.type.type.kind === 'struct' || sym.type.type.kind === 'union')) {
					// Must be copied (NOTE: They are NOT .__pointer NOw!)
					return [this.copyStruct(sym.getAssemblySymbol(), paramName, sym.type.type)];
				}
				return [this.writeSymbol(sym, paramName)];'''
assert s.count(old) == 1, s.count(old)
new = '''				const paramName = `__param_${paramId++}`;
				if ((sym.type.type.kind === 'struct' || sym.type.type.kind === 'union')) {
					// Must be copied (NOTE: They are NOT .__pointer NOw!)
					return [this.copyStruct(sym.getAssemblySymbol(), paramName, sym.type.type)];
				}
				/*
				An array parameter that takes a HANDLE: what arrives is the pair
				`<param>_get` / `<param>_set`, not a block/offset pair. Copying
				`_block` / `_pos` (which `writeSymbol` would do) leaves both
				halves undefined, and the first access then jumps through a
				register that is still 0 -- an endless loop.
				*/
				if (sym.myType?.()?.kind === 'array'
					&& (sym.arrayParamRep === 'handle' || sym.arrayParamRep === 'remote'
						|| sym.arrayParamRep === 'names')) {
					const base = sym.getAssemblySymbol();
					return [
						InstructionBuilder.set(`${base}_get`, `${paramName}_get`),
						InstructionBuilder.set(`${base}_set`, `${paramName}_set`)
					];
				}
				return [this.writeSymbol(sym, paramName)];'''
s = s.replace(old, new, 1)

# ---- 2. a memory array gets its handle from the pointer already materialised ----
old = '''		if (wantsHandle) {
			const array = this.arrayViewOf(argSymbol);
			const handle = array ? ensureArrayHandle(glob, array) : null;'''
assert s.count(old) == 1, s.count(old)
new = '''		if (wantsHandle) {
			/*
			`arrayViewOf` cannot describe a MEMORY array (it has no pointer to
			build the view from), so one is built from the value that was just
			materialised -- for an array that value IS its address.
			*/
			let array = this.arrayViewOf(argSymbol);
			if (!array && value instanceof PointerRet) {
				const length = arrayLengthOfType(slotType) || this.arrayLengthOf(argSymbol) || 0;
				array = new TraditionalArrayRet(glob, value, slotType ?? argSymbol.myType?.(), length);
			}
			const handle = array ? ensureArrayHandle(glob, array) : null;'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('handles survive being passed through the fixed parameter slots')
