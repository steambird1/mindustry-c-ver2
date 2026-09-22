p = '/data/workspace/src/mindcOptimizer.js'
s = open(p, encoding='utf-8').read()

# ---- 1. helper ----
anchor = '''	cloneAST(node) {'''
assert s.count(anchor) == 1
helper = '''	/**
	 * Point every node of a CLONED subtree at its parent WITHIN that subtree.
	 *
	 * `cloneAST` copies `parent` from the original, so a clone's root still
	 * points into the original tree. That leaks: `replaceNode` edits
	 * `oldNode.parent`, so inlining a function a SECOND time renamed the
	 * identifiers of the ORIGINAL body -- and the second copy then referred to
	 * the parameters of the first inlining (names belonging to a scope that is
	 * not an ancestor of it), which failed as "Unknown variable".
	 *
	 * @param {any} root
	 * @param {any?} [parent]
	 * @returns {any} root
	 */
	reparentCloned(root, parent = null) {
		const seen = new Set();
		const skip = new Set(['parent', 'scope', 'symbol', '_attributes', 'dataType', 'location']);
		const fix = (node, from) => {
			if (!node || typeof node !== 'object' || seen.has(node)) return;
			seen.add(node);
			node.parent = from;
			const visit = child => {
				if (!child || typeof child !== 'object') return;
				if (Array.isArray(child)) { child.forEach(visit); return; }
				if (typeof child.type !== 'string') return;
				fix(child, node);
			};
			for (const key of Object.keys(node)) {
				if (skip.has(key)) continue;
				visit(node[key]);
			}
		};
		fix(root, parent);
		return root;
	}

''' + anchor
s = s.replace(anchor, helper, 1)

# ---- 2. use it on the cloned body ----
old = '''		const clonedBody = this.cloneAST(funcNode.body);
			{
				const names = new Set(); const seen = new Set();
				const w = n => { if(!n||typeof n!=='object'||seen.has(n))return; seen.add(n);
					if(Array.isArray(n)){n.forEach(w);return;}
					if (n.type==='Identifier') names.add(n.name);
					for (const k of Object.keys(n)) { if(k==='parent'||k==='scope'||k==='_attributes')continue; w(n[k]); } };
				w(funcNode.body);
				console.error('ORIG BODY of '+funcNode.name+': '+[...names].join(','));
			}
		if (!clonedBody) return false;'''
assert s.count(old) == 1, s.count(old)
new = '''		const clonedBody = this.reparentCloned(this.cloneAST(funcNode.body), null);
		if (!clonedBody) return false;'''
s = s.replace(old, new, 1)

# ---- 3. drop the debug print in changeParameter ----
old = """					if (ziel) {
						// TODO: Add new symbol into caller's symbol table!
						console.error('INLINE param', param.name, '->', symbolName, 'ziel=', ziel?.getPath?.(), 'srcSym=', !!funcNode.scope.lookup(param.name));
						this.duplicateVariable(funcNode.scope, param.name, ziel, symbolName);
						const symbolTarget = ziel.lookupCurrent(symbolName);
						console.error('   registered?', !!symbolTarget);"""
assert s.count(old) == 1
new = """					if (ziel) {
						// TODO: Add new symbol into caller's symbol table!
						this.duplicateVariable(funcNode.scope, param.name, ziel, symbolName);
						const symbolTarget = ziel.lookupCurrent(symbolName);"""
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('inlined bodies no longer leak into the original')
