p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- overload resolution at the call site ----
old = '''    visitFunctionCall(node) {
		if (node.callee && node.callee.type === 'Identifier' && node.callee.name === 'byname') {'''
assert s.count(old) == 1, s.count(old)
new = '''    /**
     * Pick which of several functions sharing a name this call means.
     *
     * Called after the arguments have been visited (their types are needed)
     * and rewrites `node.callee.name` to the chosen function's emitted name, so
     * that everything downstream -- the generator, the optimizer, the inliner --
     * sees one ordinary function, as before.
     *
     * @param {any} node A FunctionCall
     * @returns {void}
     */
    resolveOverloadedCall(node) {
        if (node?.callee?.type !== 'Identifier') return;
        const name = String(node.callee.name ?? '');
        const set = this.overloadSets?.get(name) ?? null;
        if (!set || set.length <= 1) return;
        const argTypes = (node.arguments ?? []).map(arg => this.getExpressionType(arg));
        const score = entry => {
            if (entry.paramTypes.length !== argTypes.length) return -1;
            let total = 0;
            for (let i = 0; i < argTypes.length; i++) {
                const want = entry.paramTypes[i];
                const got = argTypes[i];
                if (!got) continue;
                if (String(got.name ?? got) === String(want)) continue;			// exact
                if (this.isTypeCompatible(want, got)) { total += 1; continue; }	// convertible
                return -1;
            }
            return total;
        };
        let best = null;
        let bestScore = -1;
        for (const entry of set) {
            const got = score(entry);
            if (got < 0) continue;
            if (best === null || got < bestScore) { best = entry; bestScore = got; }
        }
        if (!best) {
            this.addError(`No version of '${name}' accepts these arguments`
                + ` (${argTypes.map(t => String(t?.name ?? t)).join(', ')})`, node.location);
            return;
        }
        if (String(best.node.name) === name) return;
        node.callee.name = best.node.name;
        const symbol = this.currentScope?.lookup?.(best.node.name) ?? null;
        if (symbol) node.callee.symbol = symbol;
    }

''' + old
s = s.replace(old, new, 1)

# ---- call it, right after the arguments have been visited ----
old2 = '''		node.arguments.forEach((arg, index) => this.visit(arg, {
			givenType: this.getTypeInfo(expectedParams[index].type),
			givenTypeUnsure: true
		}));
'''
assert s.count(old2) == 1, s.count(old2)
new2 = '''		node.arguments.forEach((arg, index) => this.visit(arg, {
			givenType: this.getTypeInfo(expectedParams[index].type),
			givenTypeUnsure: true
		}));

		/*
		Only now are the argument types known, so only now can the right
		overload be chosen. Everything below then works on that one.
		*/
		this.resolveOverloadedCall(node);
		if (node.callee.type === 'Identifier') {
			const chosen = this.currentScope?.lookup?.(node.callee.name) ?? null;
			if (chosen && chosen.kind === 'function') {
				funcSymbol = chosen;
				funcType = chosen.myType();
				readableFunctionName = chosen.name;
				expectedParams = funcType.parameters || [];
			}
		}
'''
s = s.replace(old2, new2, 1)

# ---- no longer refuse `auto` / #pragma overload ----
old3 = '''    checkOverloading(node) {
        const mode = this.compiler?.overloadMode ?? null;
        if (mode !== null && mode !== undefined) {
            this.addError(
                `Function overloading is not implemented yet: '#pragma overload(${mode})' cannot be used`,
                node.location ?? null);
        }
        for (const param of (node.parameters ?? [])) {
            const qualifiers = param?.type?.getAttribute?.('qualifiers') ?? [];
            const isAuto = qualifiers.includes('auto')
                || /\\bauto\\b/.test(String(this.getTypeNameFromTypeNode(param) ?? ''));
            if (isAuto) {
                this.addError(
                    `Function overloading is not implemented yet: an 'auto' parameter `
                    + `('${param?.name ?? '?'}') would need one version of this function `
                    + `per representation`, param?.location ?? node.location ?? null);
            }
        }
    }'''
assert s.count(old3) == 1, s.count(old3)
new3 = '''    checkOverloading(node) {
        const mode = this.compiler?.overloadMode ?? null;
        const hasAuto = (node.parameters ?? []).some(param => this.hasAutoQualifier(param));
        if (hasAuto && mode === 'none') {
            this.addError(`An 'auto' parameter needs function overloading, which is turned off `
                + `by '#pragma overload(none)'`, node.location ?? null);
        }
        /* Whether two functions may share a name is decided in
           `prescanFunctionDeclarations`. */
    }'''
s = s.replace(old3, new3, 1)

open(p, 'w', encoding='utf-8').write(s)
print('call-site resolution added')
