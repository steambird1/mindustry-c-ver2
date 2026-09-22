p = '/data/workspace/src/mindcGenerator.js'
s = open(p, encoding='utf-8').read()

# ---- 1. a view of an array symbol that also handles the remote case ----
old = '''	/**
	 * The name of element `index` of an array value, or the register holding it.'''
assert s.count(old) == 1
new = '''	/**
	 * The array view of a symbol, whatever layout it uses.
	 *
	 * A remote array is not covered by `arrayRetFor`: its elements are registers
	 * of ANOTHER processor, so the view has to name that processor instead of
	 * being chosen from the layouts available here.
	 *
	 * @param {import('./mindcSemantic.js').SymbolEntry} symbol
	 * @returns {import('./mindcInfrastructure.js').ArrayRet?}
	 */
	arrayViewOf(symbol) {
		const glob = this.glob;
		const type = symbol?.myType?.() ?? null;
		if (!type || type.kind !== 'array') return null;
		if (symbol.isRemote === true) {
			const target = symbol.remoteName ?? symbol.remoteTarget?.getAssemblySymbol?.() ?? null;
			if (!target) return null;
			return new RemoteArrayRet(glob, remoteDeviceRegOf(symbol.getAssemblySymbol()),
				target, type, arrayLengthOfType(type));
		}
		return this.arrayRetFor(symbol, null);
	}

	/**
	 * The name of element `index` of an array value, or the register holding it.'''
s = s.replace(old, new, 1)

old = '''				const array = this.arrayRetFor(argSymbol, null);'''
assert s.count(old) == 1, s.count(old)
s = s.replace(old, '''				const array = this.arrayViewOf(argSymbol);''', 1)

open(p, 'w', encoding='utf-8').write(s)
print('generator patched (2)')

# ---- 2. an array handed to a function escapes: it can no longer be folded ----
p2 = '/data/workspace/src/mindcSemantic.js'
t = open(p2, encoding='utf-8').read()
old2 = '''            } else {
                notes.traditional = true;
            }'''
assert t.count(old2) == 1, t.count(old2)
new2 = '''            } else {
                notes.traditional = true;
            }
            /*
            The callee can write into the array, and this program cannot see
            when it does. So the array is no longer a set of known constants --
            without this, `print(a[1])` after a call would be folded back to the
            value the array was initialised with and lose the write.
            */
            argSymbol.arrayEscapes = true;'''
t = t.replace(old2, new2, 1)
open(p2, 'w', encoding='utf-8').write(t)
print('semantic patched (2)')

# ---- 3. isFoldableArray honours it ----
p3 = '/data/workspace/src/mindcOptimizer.js'
u = open(p3, encoding='utf-8').read()
old3 = '''		if (symbol.isVolatile || symbol.isExtern || symbol.isRemoteTarget) return false;
		if (symbol.isAddressed) return false;
		return true;'''
assert u.count(old3) == 1, u.count(old3)
new3 = '''		if (symbol.isVolatile || symbol.isExtern || symbol.isRemoteTarget) return false;
		if (symbol.isAddressed) return false;
		/*
		Passed to a function: the callee may write into it at any time, so its
		contents are not known constants any more.
		*/
		if (symbol.arrayEscapes === true) return false;
		return true;'''
u = u.replace(old3, new3, 1)
open(p3, 'w', encoding='utf-8').write(u)
print('optimizer patched (2)')
