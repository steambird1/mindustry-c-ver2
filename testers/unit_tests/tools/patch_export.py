p = '/data/workspace/src/mindcGenerator.js'
s = open(p, encoding='utf-8').read()

old = '''			if (symbol.isExtern && !isArray) {
				push(symbol.getAssemblySymbol());
				continue;
			}'''
assert s.count(old) == 1, s.count(old)
new = '''			if (symbol.isExtern && !isArray) {
				/*
				An exported POINTER is TWO registers over there (`qq_block` and
				`qq_pos`) -- that pair is exactly what `int *remote` reads back,
				so those two names are the ones that have to be declared. The
				pointer's own name alone would leave the other processor reading
				registers that do not exist.
				*/
				if (type && type.kind === 'pointer') {
					push(`${symbol.getAssemblySymbol()}_block`);
					push(`${symbol.getAssemblySymbol()}_pos`);
				} else {
					push(symbol.getAssemblySymbol());
				}
				continue;
			}'''
s = s.replace(old, new, 1)
open(p, 'w', encoding='utf-8').write(s)
print('export patched')
