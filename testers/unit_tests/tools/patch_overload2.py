p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ============================================ 2. auto template expansion ====
anchor = '''    /**
     * Turn the notes collected at every call site into one decision per array
     * parameter. Called once, after the whole program has been visited.'''
assert s.count(anchor) == 1
extra = '''    /**
     * Which representation an `auto` parameter has to use for one argument.
     *
     * Only what can be known for sure is used; everything else falls back to
     * the representation that is always correct (a memory pointer, or an array
     * handle). Guessing the other way would generate wrong code.
     *
     * @param {any} template The function declaration
     * @param {number} index Which parameter
     * @param {any} arg The argument at this call site
     * @returns {'name' | 'memory' | 'handle' | 'unknown'}
     */
    autoRepresentationOf(template, index, arg) {
        const param = (template.parameters ?? [])[index];
        if (!param) return 'unknown';
        const type = this.getTypeInfo(this.getTypeNameFromTypeNode(param));
        let inner = arg;
        if (inner && inner.type === 'UnaryExpression' && inner.operator === '&') inner = inner.argument;
        const symbol = (inner && inner.type === 'Identifier')
            ? (inner.symbol ?? this.globalScope?.lookup?.(inner.name) ?? null) : null;
        if (!symbol) return 'unknown';
        if (type && type.kind === 'array') {
            /*
            An array with no address of its own has to travel as a handle; one
            in memory travels as a pointer.
            */
            if (symbol.isRemote === true) return 'handle';
            const requested = symbol.requestedArrayImplementation ?? null;
            if (requested === 'traditional') return 'memory';
            if (requested === null && !(this.compiler?.arrayOptimize === true)) return 'memory';
            return 'handle';
        }
        if (type && type.kind === 'pointer') {
            /*
            `&x` can be the NAME of x, which lets x stay in a register -- but
            only when x really is one plain register and name pointers are on.
            */
            if (arg && arg.type === 'UnaryExpression' && arg.operator === '&') {
                const targetType = symbol.myType?.() ?? null;
                const oneRegister = !!targetType && targetType.size === 1
                    && !['array', 'struct', 'union'].includes(targetType.kind);
                const movable = !symbol.isVolatile && !symbol.isExtern && !symbol.isStatic
                    && !symbol.accessThroughPointer && !symbol.needMemoryAllocation;
                if (oneRegister && movable && this.namePointersEnabled()) return 'name';
                return 'memory';
            }
            if (symbol.usesNamePointer === true) return 'name';
            if (symbol.myType?.()?.kind === 'array') return 'memory';
            return 'memory';
        }
        return 'unknown';
    }

    /**
     * Does the body use the `auto` parameter in a way only an address allows?
     *
     * A name pointer or an array handle cannot be moved, so `s + 1` (and
     * `s[i]`, which is the same thing) rules that instance out.
     *
     * @param {any} template
     * @param {string} paramName
     * @returns {boolean}
     */
    autoBodyNeedsAddress(template, paramName) {
        let found = false;
        const walk = node => {
            if (!node || typeof node !== 'object' || found) return;
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (node.type === 'BinaryExpression'
                && (node.operator === '+' || node.operator === '-')
                && [node.left, node.right].some(side => side?.type === 'Identifier' && side.name === paramName)) {
                found = true; return;
            }
            if (node.type === 'MemberExpression') {
                const object = node.children?.[0] ?? node.object ?? null;
                if (object?.type === 'Identifier' && object.name === paramName) { found = true; return; }
            }
            for (const key of Object.keys(node)) {
                if (key === 'parent') continue;
                walk(node[key]);
            }
        };
        walk(template.body);
        return found;
    }

    /**
     * Emit one version of every `auto` function per representation of its
     * arguments.
     *
     * `void f(auto int *s)` is a TEMPLATE, not a function: what `s` has to be
     * (a name, an address, an array handle) depends on what each call site
     * hands over. One call site needing a name and another needing an address
     * used to be a silent miscompilation -- a single function cannot do both.
     * Here each call site picks its own version.
     *
     * @param {any} ast
     * @returns {void}
     */
    expandAutoTemplates(ast) {
        const templates = (ast?.functions ?? []).filter(
            func => (func?.parameters ?? []).some((param, i) => this.hasAutoQualifier(param)));
        if (!templates.length) return;

        /** @type {any[]} */
        const calls = [];
        const walk = node => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (node.type === 'FunctionCall') calls.push(node);
            for (const key of Object.keys(node)) {
                if (key === 'parent') continue;
                walk(node[key]);
            }
        };
        walk(ast);

        for (const template of templates) {
            const originalName = String(template.name ?? '');
            const autoIndices = (template.parameters ?? [])
                .map((param, i) => (this.hasAutoQualifier(param) ? i : -1)).filter(i => i >= 0);
            const mine = calls.filter(call => call?.callee?.type === 'Identifier'
                && String(call.callee.name) === originalName);
            const groups = new Map();
            for (const call of mine) {
                const signature = autoIndices
                    .map(i => this.autoRepresentationOf(template, i, call.arguments?.[i] ?? null)).join('|');
                if (!groups.has(signature)) groups.set(signature, []);
                groups.get(signature).push(call);
            }
            if (groups.size === 0) continue;
            /*
            Nothing is really being overloaded here, just specialised: mark
            every instance so the versions keep their own names.
            */
            const instances = [];
            let index = 0;
            for (const [signature, callSites] of groups) {
                const reps = signature.split('|');
                const name = this.mangleFunctionName(originalName, index++);
                for (let a = 0; a < autoIndices.length; a++) {
                    const paramIndex = autoIndices[a];
                    const paramName = template.parameters[paramIndex]?.name;
                    if (reps[a] !== 'memory' && paramName
                        && this.autoBodyNeedsAddress(template, paramName)) {
                        this.addError(`Parameter '${paramName}' of '${originalName}' is 'auto', and this `
                            + `call hands it something that has no address (${reps[a]}) -- but the body `
                            + `moves the pointer (s + 1, or s[i]), which needs one`,
                            callSites[0]?.location ?? null);
                    }
                }
                const copy = this.cloneAstNode(template);
                copy.name = name;
                copy.scope = null;
                copy.setAttribute('autoInstance', true);
                copy.setAttribute('autoReps', signature);
                autoIndices.forEach((paramIndex, a) => {
                    const param = copy.parameters?.[paramIndex];
                    if (param) param.setAttribute('autoRep', reps[a]);
                });
                instances.push(copy);
                for (const call of callSites) call.callee.name = name;
            }
            const list = ast.functions ?? [];
            const at = list.indexOf(template);
            if (at >= 0) list.splice(at, 1, ...instances);
        }
    }

''' + anchor
s = s.replace(anchor, extra, 1)

# ============================================ 3. hook into visitProgram ====
old = '''    visitProgram(node) {
        // 遍历所有全局声明和函数
		node.globalDeclarations.forEach(decl => this.visit(decl));
        node.functions.forEach(func => this.visit(func));
    }'''
assert s.count(old) == 1, s.count(old)
new = '''    visitProgram(node) {
        // 遍历所有全局声明和函数
		node.globalDeclarations.forEach(decl => this.visit(decl));
		/*
		Both passes below need the whole program: the set of overloads (a call
		may come before some of them), and the arguments of every call to an
		`auto` function (that is what decides the versions to emit).
		*/
		this.prescanFunctionDeclarations(node);
		if (this.overloadMode() !== 'none') this.expandAutoTemplates(node);
		this.prescanFunctionDeclarations(node);
        node.functions.forEach(func => this.visit(func));
    }'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('auto templates + visitProgram hooked')
