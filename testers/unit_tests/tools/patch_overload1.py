p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ============================================================ 1. helpers ====
old = '''    /**
     * The name a function is emitted under.
     *
     * RESERVED FOR FUNCTION OVERLOADING: once several functions may share a
     * name, the emitted name has to differ per parameter list (otherwise two
     * overloads would collide in `FunctionRegisterer`). Today there is only one
     * function per name, so this returns the name unchanged -- and the parts
     * that would need it (`functionInfo`, `functionCallGraph`, the call sites)
     * are still keyed by the plain name.
     *
     * @param {string} name
     * @param {any[]} [parameterTypes]
     * @returns {string}
     */
    mangleFunctionName(name, parameterTypes = []) {
        return name;
    }

    /**
     * How the compiler reacts to several functions sharing one name.
     *
     * RESERVED FOR FUNCTION OVERLOADING -- see `#pragma overload`. Not
     * implemented yet: anything that asks for it is rejected in
     * `visitFunctionDeclaration`.
     *
     * @returns {'auto' | 'default' | 'none'}
     */
    overloadMode() {
        return 'none';
    }
'''
assert s.count(old) == 1, s.count(old)
new = '''    /**
     * The name a function is emitted under.
     *
     * Several functions may share a name (overloading), and they must not
     * collide in the `FunctionRegisterer` -- so all but the first get a
     * suffixed name. The first keeps the plain name, which keeps ordinary
     * programs untouched.
     *
     * @param {string} name
     * @param {number} [index] Position among the functions sharing this name
     * @returns {string}
     */
    mangleFunctionName(name, index = 0) {
        return index === 0 ? name : `${name}__ov${index}`;
    }

    /**
     * How the compiler reacts to several functions sharing one name.
     *
     * `#pragma overload(auto | default | none)`. `default` (and `auto`) allow
     * it; `none` refuses.
     *
     * @returns {'auto' | 'default' | 'none'}
     */
    overloadMode() {
        const mode = this.compiler?.overloadMode ?? null;
        return (mode === 'auto' || mode === 'default' || mode === 'none') ? mode : 'default';
    }

    /**
     * Whether a parameter is written `auto` -- `void f(auto int *s)`.
     *
     * `auto` is also a storage class (`auto device`), so the qualifier may sit
     * in either place, exactly as `byname` does.
     *
     * @param {any} node A parameter node
     * @returns {boolean}
     */
    hasAutoQualifier(node) {
        const levels = [
            ...(node?.pointerQualifiers ?? []),
            ...(node?.type?.pointerQualifiers ?? []),
            node?.type?.getAttribute?.('qualifiers') ?? []
        ];
        if (levels.some(list => (list ?? []).includes('auto'))) return true;
        return /\\bauto\\b/.test(String(this.getTypeNameFromTypeNode(node) ?? ''));
    }

    /**
     * Whether a pointer that only ever holds register names is allowed here.
     * @returns {boolean}
     */
    namePointersEnabled() {
        const config = this.compiler?.config ?? null;
        return (config?.getAttribute?.('doPointerOptimize') === true)
            || (config?.getAttribute?.('optimizePointer') === true)
            || (this.compiler?.optimizerConfig?.getAttribute?.('doPointerOptimize') === true);
    }

    /**
     * A deep copy of an AST subtree.
     *
     * Needed to emit one version of an `auto` function per representation of
     * its arguments: the versions are the same program, only the parameter's
     * representation differs, so the body has to be copied rather than shared.
     *
     * @param {any} node
     * @param {Map} [seen]
     * @returns {any}
     */
    cloneAstNode(node, seen = new Map()) {
        if (node === null || node === undefined || typeof node !== 'object') return node;
        if (Array.isArray(node)) return node.map(n => this.cloneAstNode(n, seen));
        if (seen.has(node)) return seen.get(node);
        if (typeof node.type !== 'string' || !(node._attributes instanceof Map)) return node;
        const copy = new ASTNode(node.type, node.location);
        seen.set(node, copy);
        for (const [key, value] of node._attributes) copy.setAttribute(key, value);
        for (const key of Object.keys(node)) {
            if (key === 'parent' || key === '_attributes' || key === 'type' || key === 'location') continue;
            copy[key] = this.cloneAstNode(node[key], seen);
        }
        return copy;
    }

    /**
     * The parameter type list of a function declaration, as type names.
     * @param {any} node
     * @returns {string[]}
     */
    parameterTypeNamesOf(node) {
        return (node?.parameters ?? []).map(param => String(this.getTypeNameFromTypeNode(param) ?? '?'));
    }

    /**
     * Collect every function declaration and give each one the name it will be
     * emitted under.
     *
     * Done before anything is visited, so that a call site always sees the
     * complete set of overloads -- a call may appear before some of them.
     *
     * @param {any} ast
     * @returns {void}
     */
    prescanFunctionDeclarations(ast) {
        /** @type {Map<string, {node: any, paramTypes: string[]}[]>} */
        this.overloadSets = new Map();
        for (const func of (ast?.functions ?? [])) {
            if (!func || func.type !== 'FunctionDeclaration' || !func.name) continue;
            if (!this.overloadSets.has(func.name)) this.overloadSets.set(func.name, []);
            this.overloadSets.get(func.name).push({ node: func, paramTypes: this.parameterTypeNamesOf(func) });
        }
        for (const [name, list] of this.overloadSets) {
            list.forEach((entry, index) => {
                entry.node.name = this.mangleFunctionName(name, index);
            });
            /*
            Two functions with the same name AND the same parameter list are
            not overloads -- they are a redefinition.
            */
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    if (list[i].paramTypes.join(',') === list[j].paramTypes.join(',')) {
                        this.addError(`Function '${name}' is already declared with these parameter types`,
                            list[j].node.location);
                    }
                }
            }
        }
    }
'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('helpers replaced')
