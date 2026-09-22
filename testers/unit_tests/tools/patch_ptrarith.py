p = '/data/workspace/src/mindcInfrastructure.js'
s = open(p, encoding='utf-8').read()

old = '''	// pointer (+|-) integer  ->  move the pointer
	if ((left instanceof PointerRet) && !(right instanceof PointerRet) && isAddLike) {
		const base = left.get();				// read the pointer out (once!)
		const step = right.materialize();	// own temporary symbol: safe against calls'''
assert s.count(old) == 1, s.count(old)
new = '''	// pointer (+|-) integer  ->  move the pointer
	if ((left instanceof PointerRet) && !(right instanceof PointerRet) && isAddLike) {
		const base = left.get();				// read the pointer out (once!)
		/*
		A pointer that holds a NAME has no address to move: `q + 1` used to be
		emitted anyway, copying `q_block` / `q_pos` -- registers a name pointer
		never sets -- and the program then walked off to a link that does not
		exist. Saying so is better than emitting code that traps.
		*/
		if (base instanceof NamePointerRet || base instanceof NameStructPointerRet
			|| base instanceof RemotePointerRet) {
			throw new InfrastructureNotImplementedExpection(
				'pointer arithmetic on a pointer that holds a name: it names a register, '
				+ 'so it has no address that could be moved');
		}
		const step = right.materialize();	// own temporary symbol: safe against calls'''
s = s.replace(old, new, 1)
open(p, 'w', encoding='utf-8').write(s)
print('pointer arithmetic guarded')
