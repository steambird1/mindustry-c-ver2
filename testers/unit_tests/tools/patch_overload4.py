p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- the chosen representation reaches the parameter symbol ----
old = '''			if (this.hasByNameQualifier(param)) {
				paramSymbol.usesNamePointer = true;
				paramSymbol.forcedNamePointer = true;
			}'''
assert s.count(old) == 1, s.count(old)
new = '''            if (this.hasByNameQualifier(param)) {
				paramSymbol.usesNamePointer = true;
				paramSymbol.forcedNamePointer = true;
			}
			/*
			An `auto` parameter of an instantiated version: the representation
			this version was made for. Setting it here -- instead of letting the
			call-site notes decide -- is what lets one version take names while
			another takes addresses, which a single function cannot do.
			*/
			const autoRep = param.getAttribute?.('autoRep') ?? null;
			if (autoRep === 'name') {
				paramSymbol.usesNamePointer = true;
				paramSymbol.forcedNamePointer = true;
			} else if (autoRep === 'memory' || autoRep === 'handle') {
				paramSymbol.noNamePointer = true;
				paramSymbol.arrayParamRep = (autoRep === 'handle' && gotType.kind === 'array')
					? 'handle' : (gotType.kind === 'array' ? 'traditional' : null);
			}'''
s = s.replace(old, new, 1)

# ---- finalizeArrayParameters must not override an instance ----
old2 = '''                const notes = symbol.arrayArgumentNotes;
                if (!notes) continue;'''
assert s.count(old2) == 1, s.count(old2)
new2 = '''                const notes = symbol.arrayArgumentNotes;
                /*
                A version emitted for one representation already knows it:
                re-deciding from the call-site notes would mix them back
                together, which is exactly what the versions are here to avoid.
                */
                if (symbol.arrayParamRep) continue;
                if (!notes) continue;'''
s = s.replace(old2, new2, 1)

open(p, 'w', encoding='utf-8').write(s)
print('auto representation wired into parameters')

p2 = '/data/workspace/src/mindcOptimizer.js'
t = open(p2, encoding='utf-8').read()
old3 = '''				for (const key of group) {
					const entry = pointers.get(key);
					if (!entry || entry.bad) { ok = false; break; }'''
assert t.count(old3) == 1, t.count(old3)
new3 = '''				for (const key of group) {
					const entry = pointers.get(key);
					/*
					`auto` version made for real addresses: it must not be given
					the name representation, even if every call site would allow
					it -- the body may move the pointer.
					*/
					if (entry?.symbol?.noNamePointer === true) { ok = false; break; }
					if (!entry || entry.bad) { ok = false; break; }'''
t = t.replace(old3, new3, 1)
open(p2, 'w', encoding='utf-8').write(t)
print('name pointer analysis respects auto instances')
