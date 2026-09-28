p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- 1. dispatch on the parameter before looking at the argument ----
old = '''        const param = (template.parameters ?? [])[index];
        if (!param) return 'unknown';
        const type = this.getTypeInfo(this.getTypeNameFromTypeNode(param));
        let inner = arg;
        if (inner && inner.type === 'UnaryExpression' && inner.operator === '&') inner = inner.argument;
        const symbol = (inner && inner.type === 'Identifier')
            ? (inner.symbol ?? this.globalScope?.lookup?.(inner.name) ?? null) : null;
        const declaration = (inner && inner.type === 'Identifier' && ast)
            ? this.findDeclarationOf(ast, inner.name) : null;
        if (!symbol && !declaration) return 'unknown';'''
assert s.count(old) == 1, s.count(old)
new = '''        const param = (template.parameters ?? [])[index];
        if (!param) return 'unknown';
        const type = this.getTypeInfo(this.getTypeNameFromTypeNode(param));
        /*
        Look at the PARAMETER before looking at the argument: whether there is
        anything to decide follows from the parameter alone.

        A SCALAR has exactly one representation, so `void f(auto int x)` is
        simply `void f(int x)` -- nothing is specialised and no argument has to
        be inspected. Refusing anything but a bare name here is what rejected
        `f(3)`, `f((int)q)` and every other ordinary expression.
        */
        if (!type) return 'unknown';
        if (type.kind !== 'array' && type.kind !== 'pointer') return 'scalar';
        let inner = arg;
        if (inner && inner.type === 'UnaryExpression' && inner.operator === '&') inner = inner.argument;
        const symbol = (inner && inner.type === 'Identifier')
            ? (inner.symbol ?? this.globalScope?.lookup?.(inner.name) ?? null) : null;
        const declaration = (inner && inner.type === 'Identifier' && ast)
            ? this.findDeclarationOf(ast, inner.name) : null;
        if (!symbol && !declaration) return 'unknown';'''
s = s.replace(old, new, 1)

# ---- 2. drop the duplicated pointer block (it shadowed the real one) ----
old = '''        if (type && type.kind === 'pointer') {
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
'''
assert s.count(old) == 1, s.count(old)
s = s.replace(old, '', 1)

# ---- 3. a scalar is never "moved like a pointer" ----
old = '''                    if (reps[a] !== 'memory' && paramName
                        && this.autoBodyNeedsAddress(template, paramName)) {'''
assert s.count(old) == 1, s.count(old)
new = '''                    /*
                    `scalar` is exempt: `x + 1` on a plain int is arithmetic,
                    not a pointer being stepped, so it says nothing about the
                    representation.
                    */
                    if (reps[a] !== 'memory' && reps[a] !== 'scalar' && paramName
                        && this.autoBodyNeedsAddress(template, paramName)) {'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('auto on a scalar parameter is now a no-op, and the pointer branch runs')
