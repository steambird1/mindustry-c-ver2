p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- 1. document the meaning of remote(dev, var) ----
old = '''	 * The processor may be any device expression; the variable has to be one
	 * that the OTHER processor really has a register for, so it must be a
	 * global (a local's register name depends on optimisations that differ
	 * between two programs).
	 *'''
assert s.count(old) == 1, s.count(old)
new = '''	 * `remote(dev, x)` means: ON THE DEVICE `dev` there is a variable named
	 * `x`, and this declaration operates THAT one. Every access is a
	 * `read` / `write` to `dev`, so the variable need not be declared in this
	 * program at all -- its NAME is all that is needed.
	 *
	 * A declaration of the same name here is therefore only a DESCRIPTION of
	 * the variable over there (its type, and for an array its length and
	 * layout); it does NOT become the thing being read and written. The one
	 * exception is `remote(@this, x)`: the device is this very processor, so
	 * the local declaration really is the target.
	 *
	 * `dev` may be any device expression. For a variable over there it should
	 * be a global (a local's register name depends on optimisations that differ
	 * between two programs).
	 *'''
s = s.replace(old, new, 1)

# ---- 2. recognise `remote(@this, ...)` ----
old = '''		const deviceNode = args[0];
		const targetNode = args[1];'''
assert s.count(old) == 1, s.count(old)
new = '''		const deviceNode = args[0];
		const targetNode = args[1];
		/*
		`remote(@this, x)` is the one case where the local declaration IS the
		target: the device named is this very processor.
		*/
		const selfDevice = deviceNode?.type === 'Identifier'
			&& String(deviceNode.name) === '@this';'''
s = s.replace(old, new, 1)

# ---- 3. an identifier that is not declared here names the variable over there ----
old = '''		if (!targetSymbol) {
			/*
			Not declared YET: `remote int ru[] = remote(p1, u);` may well appear
			before `int u[4];`. Nothing about this binding can be decided before'''
assert s.count(old) == 1, s.count(old)
new = '''		if (!targetSymbol && inner.type === 'Identifier' && !selfDevice) {
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
		}
		if (!targetSymbol) {
			/*
			Not declared YET: `remote int ru[] = remote(p1, u);` may well appear
			before `int u[4];`. Nothing about this binding can be decided before'''
s = s.replace(old, new, 1)

# ---- 4. keep the local declaration alive only when it really is the target ----
old = '''		targetSymbol.isRemoteTarget = true;
		declarator.initializer = null;
		symbol.remoteDevice = deviceNode;'''
assert s.count(old) == 1, s.count(old)
new = '''		/*
		Only `remote(@this, x)` really uses the declaration of this program:
		elsewhere the declaration is just a description of a variable that lives
		on the other processor, and emitting registers for it here would only
		waste them.
		*/
		if (selfDevice) targetSymbol.isRemoteTarget = true;
		declarator.initializer = null;
		symbol.remoteDevice = deviceNode;'''
s = s.replace(old, new, 1)

old = '''			targetSymbol.isRemoteTarget = true;
		}'''
assert s.count(old) == 1, s.count(old)
new = '''			if (selfDevice) targetSymbol.isRemoteTarget = true;
		}'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('remote semantics patched')
