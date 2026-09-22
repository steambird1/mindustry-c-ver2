p = '/data/workspace/src/mindcInfrastructure.js'
s = open(p, encoding='utf-8').read()

# ---- 1. handleShapeOf: a memory array can have a handle too ----
old = '''	if (typeof array.elementName === 'function') {
		const names = [];
		for (let i = 0; i < array.length; i++) names.push(array.elementName(i));
		return { length: array.length, device: '@this', names, dynamic: false };
	}
	return null;
}'''
assert s.count(old) == 1
new = '''	if (typeof array.elementName === 'function') {
		const names = [];
		for (let i = 0; i < array.length; i++) names.push(array.elementName(i));
		return { length: array.length, device: '@this', names, dynamic: false };
	}
	/*
	A MEMORY array has no element NAMES, but it does have an address -- and an
	address is enough: the helper computes `base + i * size`, turns the block
	number into the building and reads through it. No `select` chain is needed,
	which is what makes this cheap even for a long array.

	This is the one layout that can also travel as a plain pointer, so it keeps
	that ability; the handle is an additional representation, not a replacement.
	*/
	if (array instanceof TraditionalArrayRet) {
		const pointer = array.pointer ?? null;
		if (!pointer) return null;
		return {
			length: array.length,
			kind: 'memory',
			block: pointer.blockOperand?.() ?? `${pointer.name}_block`,
			pos: `${pointer.name}_pos`,
			size: array.elementSize ?? 1,
			names: [], dynamic: false
		};
	}
	return null;
}'''
s = s.replace(old, new, 1)

# ---- 2. build(): the memory shape ----
old = '''		const body = new Instruction();
		if (kind === 'get') {
			if (shape.dynamic) {'''
assert s.count(old) == 1
new = '''		const body = new Instruction();
		/*
		A memory array: work out the address of element `__arridx` first, then
		read or write through it. `getlink` has to happen INSIDE the helper
		because only there is the offset known.
		*/
		if (shape.kind === 'memory') {
			if (shape.size > 1) {
				body.concat(InstructionBuilder.op('mul', '__arrsel', '__arridx', shape.size));
				body.concat(InstructionBuilder.op('add', '__arrsel', shape.pos, '__arrsel'));
			} else {
				body.concat(InstructionBuilder.op('add', '__arrsel', shape.pos, '__arridx'));
			}
			body.concat(InstructionBuilder.getlink('__arrblk', shape.block));
			if (kind === 'get') {
				body.concat(InstructionBuilder.read('__arrret', '__arrblk', '__arrsel'));
			} else {
				body.concat(InstructionBuilder.write('__arrval', '__arrblk', '__arrsel'));
			}
			reg.addFunction(key, body, null, [], true, false, true);
			reg.functionCollection.get(key).calls++;
			return key;
		}
		if (kind === 'get') {
			if (shape.dynamic) {'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('memory arrays can now be described by a handle')
