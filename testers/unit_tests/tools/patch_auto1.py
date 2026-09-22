p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- helper: find the declaration of a name straight from the AST ----
anchor = '''    autoRepresentationOf(template, index, arg) {'''
assert s.count(anchor) == 1
helper = '''    /**
     * The declaration a name refers to, found in the AST itself.
     *
     * Needed because an `auto` function is specialised BEFORE the program is
     * visited: at that point no scope holds the locals yet, so `scope.lookup()`
     * cannot answer. Everything that decides a representation -- `remote`,
     * `array("embedded_divided", ...)`, a plain `int b[4]` -- is visible in the
     * source, so reading it there is enough.
     *
     * @param {any} ast
     * @param {string} name
     * @returns {{declarator: any, declaration: any, isRemote: boolean}?}
     */
    findDeclarationOf(ast, name) {
        const wanted = String(name ?? '');
        if (!wanted) return null;
        let found = null;
        const seen = new Set();
        const look = declaration => {
            if (found || !declaration) return;
            for (const declarator of (declaration.declarators ?? [])) {
                if (String(declarator?.name ?? '') !== wanted) continue;
                const qualifiers = [
                    ...(declaration.type?.getAttribute?.('qualifiers') ?? []),
                    ...(declarator.type?.getAttribute?.('qualifiers') ?? [])
                ];
                /*
                `remote int ru[] = remote(dev, u)`: the qualifier may sit on the
                declaration or on the declarator, and the binding itself is a
                `remote(...)` call -- any of the three is enough to tell that the
                array lives in another processor.
                */
                const called = declarator?.initializer?.type === 'BuiltinCall'
                    ? declarator.initializer.functionName
                    : (declarator?.initializer?.callee?.name ?? null);
                const isRemote = qualifiers.includes('remote') || called === 'remote';
                found = { declarator, declaration, isRemote };
                return;
            }
        };
        const walk = node => {
            if (!node || typeof node !== 'object' || found || seen.has(node)) return;
            seen.add(node);
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (node.type === 'VariableDeclaration') look(node);
            for (const key of Object.keys(node)) {
                if (key === 'parent' || key === 'scope') continue;
                walk(node[key]);
            }
        };
        walk(ast);
        return found;
    }

''' + anchor
s = s.replace(anchor, helper, 1)

# ---- use it ----
old = '''    autoRepresentationOf(template, index, arg) {
        const param = (template.parameters ?? [])[index];
        if (!param) return 'unknown';
        const type = this.getTypeInfo(this.getTypeNameFromTypeNode(param));
        let inner = arg;
        if (inner && inner.type === 'UnaryExpression' && inner.operator === '&') inner = inner.argument;
        const symbol = (inner && inner.type === 'Identifier')
            ? (inner.symbol ?? this.globalScope?.lookup?.(inner.name) ?? null) : null;
        if (!symbol) return 'unknown';
        if (type && type.kind === 'array') {'''
assert s.count(old) == 1, s.count(old)
new = '''    autoRepresentationOf(template, index, arg, ast = null) {
        const param = (template.parameters ?? [])[index];
        if (!param) return 'unknown';
        const type = this.getTypeInfo(this.getTypeNameFromTypeNode(param));
        let inner = arg;
        if (inner && inner.type === 'UnaryExpression' && inner.operator === '&') inner = inner.argument;
        const symbol = (inner && inner.type === 'Identifier')
            ? (inner.symbol ?? this.globalScope?.lookup?.(inner.name) ?? null) : null;
        const declaration = (inner && inner.type === 'Identifier' && ast)
            ? this.findDeclarationOf(ast, inner.name) : null;
        if (!symbol && !declaration) return 'unknown';
        if (type && type.kind === 'array') {
            /*
            Decided from the declaration, because the choice is a property of
            how the array was written -- and it has to be known while the
            versions are still being made.
            */
            if (declaration?.isRemote || symbol?.isRemote === true) return 'handle';
            const requested = declaration?.declarator?.getAttribute?.('arrayImplementation')
                ?? symbol?.requestedArrayImplementation ?? null;
            if (requested === 'traditional') return 'memory';
            if (requested) return 'handle';
            /*
            Nothing was written down, so the layout is chosen automatically --
            and that choice is not visible here. Guessing would risk a version
            that expects a pointer for an array that ended up in registers (or
            the other way round), so refuse instead.
            */
            if (this.compiler?.arrayOptimize === true) return 'ambiguous';
            return 'memory';
        }
        if (type && type.kind === 'pointer') {'''
s = s.replace(old, new, 1)

# ---- pointer branch: a local `&x` is decided from its declaration ----
old = '''            if (arg && arg.type === 'UnaryExpression' && arg.operator === '&') {
                const targetType = symbol.myType?.() ?? null;
                const oneRegister = !!targetType && targetType.size === 1
                    && !['array', 'struct', 'union'].includes(targetType.kind);
                const movable = !symbol.isVolatile && !symbol.isExtern && !symbol.isStatic
                    && !symbol.accessThroughPointer && !symbol.needMemoryAllocation;
                if (oneRegister && movable && this.namePointersEnabled()) return 'name';
                return 'memory';
            }'''
assert s.count(old) == 1, s.count(old)
new = '''            if (arg && arg.type === 'UnaryExpression' && arg.operator === '&') {
                if (symbol) {
                    const targetType = symbol.myType?.() ?? null;
                    const oneRegister = !!targetType && targetType.size === 1
                        && !['array', 'struct', 'union'].includes(targetType.kind);
                    const movable = !symbol.isVolatile && !symbol.isExtern && !symbol.isStatic
                        && !symbol.accessThroughPointer && !symbol.needMemoryAllocation;
                    if (oneRegister && movable && this.namePointersEnabled()) return 'name';
                    return 'memory';
                }
                /*
                A local: no symbol yet, so judge the declaration. A plain scalar
                that nothing else forces into memory can be named.
                */
                const qualifierList = [
                    ...(declaration?.declaration?.type?.getAttribute?.('qualifiers') ?? []),
                    ...(declaration?.declarator?.type?.getAttribute?.('qualifiers') ?? [])
                ];
                const forced = qualifierList.includes('volatile') || qualifierList.includes('extern')
                    || qualifierList.includes('static');
                const typeName = String(declaration?.declarator?.type?.typeName
                    ?? declaration?.declaration?.type?.typeName ?? '');
                const composite = /\\bstruct\\b|\\bunion\\b|\\[/.test(typeName);
                if (!forced && !composite && this.namePointersEnabled()) return 'name';
                return 'memory';
            }'''
s = s.replace(old, new, 1)

# ---- pass the AST through ----
old = '''                    .map(i => this.autoRepresentationOf(template, i, call.arguments?.[i] ?? null)).join('|');'''
assert s.count(old) == 1, s.count(old)
new = '''                    .map(i => this.autoRepresentationOf(template, i, call.arguments?.[i] ?? null, ast)).join('|');'''
s = s.replace(old, new, 1)

# ---- refuse an ambiguous group ----
old = '''            for (const [signature, callSites] of groups) {
                const reps = signature.split('|');'''
assert s.count(old) == 1, s.count(old)
new = '''            for (const [signature, callSites] of groups) {
                const reps = signature.split('|');
                if (reps.includes('ambiguous')) {
                    this.addError(`'${originalName}' has an 'auto' parameter, and this call hands it `
                        + `an array whose layout is chosen automatically -- which one it is cannot be `
                        + `known here. Write it down (array("embedded_divided", ...), or `
                        + `array("traditional", ...)), or turn '#pragma optimize(array)' off`,
                        callSites[0]?.location ?? null);
                    continue;
                }
                if (reps.includes('unknown')) {
                    this.addError(`'${originalName}' has an 'auto' parameter, and what this call hands `
                        + `it cannot be made out`, callSites[0]?.location ?? null);
                    continue;
                }'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('auto representation now read from the declaration')
