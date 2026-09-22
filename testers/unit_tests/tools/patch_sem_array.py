p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- 1. dimension check + argument notes inside visitFunctionCall ----
old = '''            if (argType && expectedType && !this.isTypeCompatible(expectedType, argType)) {
                this.addError(
                    `Argument ${index + 1} of '${node.callee.name}' expects '${expectedType}', but got '${argType}'`,
                    arg.location
                );
            }
        });'''
assert s.count(old) == 1, s.count(old)
new = '''            if (argType && expectedType && !this.isTypeCompatible(expectedType, argType)) {
                this.addError(
                    `Argument ${index + 1} of '${node.callee.name}' expects '${expectedType}', but got '${argType}'`,
                    arg.location
                );
            }
            /*
            An array argument is NOT decayed into a pointer, so its dimensions
            stay part of the contract: every dimension the parameter names has
            to be at least as large as what is handed over. `void f(int p[])`
            names nothing and therefore accepts anything.
            */
            this.checkArrayArgumentDimensions(readableFunctionName, expectedParams[index], arg, index);
        });
        /*
        An array keeps its own layout when it is passed, so the parameter has to
        be told which layout it will be given -- see `finalizeArrayParameters`.
        */
        this.noteArrayArguments(node, funcSymbol, expectedParams);'''
s = s.replace(old, new, 1)

# ---- 2. the new methods, inserted before visitFunctionCall ----
anchor = '''    visitFunctionCall(node) {'''
assert s.count(anchor) == 1
methods = '''    /**
     * The dimensions of an array type, outermost first. `null` marks one that
     * was left unspecified (`int p[]`).
     *
     * @param {TypeInfo?} type
     * @returns {(number|null)[]}
     */
    arrayDimensionsOf(type) {
        const dims = [];
        let current = type;
        while (current && current.isTypeInfo && current.kind === 'array') {
            const size = current.arraySize ?? null;
            const value = (typeof size === 'number') ? size
                : (size && typeof size.value === 'number') ? size.value : null;
            dims.push(value);
            current = current.pointerTo ?? null;
        }
        return dims;
    }

    /**
     * `void f(int p[4])` may only be handed an array with at least 4 elements;
     * `void f(int p[][])` accepts any size. Every dimension is checked, so
     * `void f(int p[3][4])` needs `[>=3][>=4]`.
     *
     * @param {string} functionName
     * @param {{name: string, type: any}} declared The parameter as declared
     * @param {any} arg The argument expression
     * @param {number} index 0-based argument position
     * @returns {void}
     */
    checkArrayArgumentDimensions(functionName, declared, arg, index) {
        const paramType = declared?.type ?? null;
        if (!paramType || !paramType.isTypeInfo || paramType.kind !== 'array') return;
        const argType = this.getExpressionType(arg);
        if (!argType || !argType.isTypeInfo || argType.kind !== 'array') return;
        const want = this.arrayDimensionsOf(paramType);
        const got = this.arrayDimensionsOf(argType);
        if (want.length !== got.length) {
            this.addError(
                `Argument ${index + 1} of '${functionName}' is '${this.typeToString(argType)}', `
                + `which does not have the ${want.length} dimension(s) the parameter asks for`,
                arg.location);
            return;
        }
        for (let i = 0; i < want.length; i++) {
            if (want[i] === null || got[i] === null) continue;   // `[]` accepts anything
            if (got[i] < want[i]) {
                this.addError(
                    `Argument ${index + 1} of '${functionName}' has ${got[i]} element(s) in `
                    + `dimension ${i + 1}, but the parameter needs at least ${want[i]}`,
                    arg.location);
                return;
            }
        }
    }

    /**
     * Record, for each array parameter, what the call sites hand over.
     *
     * An array argument is never silently decayed into a pointer, because a
     * non-memory array has no address to decay into. So the parameter has to
     * take over the representation the caller's array uses:
     *
     *   - `remote`      -- the elements are registers of another processor;
     *   - `names`       -- an embedded / encoded layout, so the elements are
     *                      registers here and are reached by name;
     *   - `traditional` -- an ordinary in-memory array, passed as a pointer.
     *
     * @param {any} callNode
     * @param {SymbolEntry?} funcSymbol
     * @param {{name: string, type: any}[]} expectedParams
     * @returns {void}
     */
    noteArrayArguments(callNode, funcSymbol, expectedParams) {
        if (!funcSymbol) return;
        const scope = funcSymbol.owningScope ?? null;
        if (!scope) return;
        (callNode.arguments ?? []).forEach((arg, index) => {
            const declared = expectedParams[index];
            if (!declared) return;
            const paramSymbol = scope.lookup(declared.name);
            if (!paramSymbol) return;
            const paramType = paramSymbol.myType?.() ?? null;
            if (!paramType || paramType.kind !== 'array') return;
            if (arg.type !== 'Identifier') return;
            const argSymbol = this.currentScope.lookup(arg.name);
            if (!argSymbol) return;
            const argType = argSymbol.myType?.() ?? null;
            if (!argType || argType.kind !== 'array') return;
            const notes = paramSymbol.arrayArgumentNotes
                ?? (paramSymbol.arrayArgumentNotes = {
                    remote: false, register: false, traditional: false, requested: new Set()
                });
            const requested = argSymbol.requestedArrayImplementation ?? null;
            if (argSymbol.isRemote === true) {
                notes.remote = true;
            } else if (requested && requested !== 'traditional') {
                notes.register = true;
                notes.requested.add(requested);
            } else {
                notes.traditional = true;
            }
        });
    }

    /**
     * Turn the notes collected at every call site into one decision per array
     * parameter. Called once, after the whole program has been visited.
     *
     * @param {any} ast
     * @returns {void}
     */
    finalizeArrayParameters(ast) {
        const visitScope = scope => {
            if (!scope) return;
            for (const symbol of scope.symbols.values()) {
                const notes = symbol.arrayArgumentNotes;
                if (!notes) continue;
                const declaredRemote = symbol.isRemote === true;
                if (declaredRemote || notes.remote) {
                    symbol.arrayParamRep = 'remote';
                    if (notes.traditional) {
                        this.addError(`Parameter '${symbol.name}' is declared 'remote', `
                            + `but is also passed an ordinary array: the elements cannot be `
                            + `in another processor and in memory at the same time`, symbol.location);
                    }
                } else if (notes.register) {
                    symbol.arrayParamRep = 'names';
                    if (notes.traditional) {
                        this.addError(`Parameter '${symbol.name}' is passed both an array held in `
                            + `registers and an ordinary in-memory array; they have no layout in common`,
                            symbol.location);
                    }
                } else {
                    symbol.arrayParamRep = 'traditional';
                }
            }
            (scope.children ?? []).forEach(visitScope);
        };
        visitScope(this.globalScope);
    }

''' + anchor
s = s.replace(anchor, methods, 1)

# ---- 3. call it at the end of analyze() ----
old2 = "\t\tthis.collectAddressUses(ast);\n\n        return {"
assert s.count(old2) == 1, s.count(old2)
new2 = '''        this.collectAddressUses(ast);
        /*
        Only now is every call site known, so only now can each array parameter
        be told which layout it will be given.
        */
        this.finalizeArrayParameters(ast);

        return {'''
s = s.replace(old2, new2, 1)

open(p, 'w', encoding='utf-8').write(s)
print('semantic patched')
