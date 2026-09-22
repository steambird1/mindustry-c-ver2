p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- helper ----
anchor = '''    /**
     * Turn the notes collected at every call site into one decision per array
     * parameter. Called once, after the whole program has been visited.'''
assert s.count(anchor) == 1
helper = '''    /**
     * Whether `remote` appears anywhere on a type -- on the array itself, or on
     * the element level (`remote int s[4]` puts it on `int`).
     *
     * @param {TypeInfo?} type
     * @returns {boolean}
     */
    typeHasRemoteQualifier(type) {
        let current = type ?? null;
        let guard = 0;
        while (current && guard++ < 8) {
            if ((current.qualifiers ?? []).includes('remote')) return true;
            current = current.pointerTo ?? null;
        }
        return false;
    }

''' + anchor
s = s.replace(anchor, helper, 1)

# ---- decide from the declaration too ----
old = '''                if (symbol.arrayParamRep) continue;
                if (!notes) continue;
                const declaredRemote = symbol.isRemote === true;
                if (declaredRemote || notes.remote) {
                    symbol.arrayParamRep = 'handle';
                    if (notes.traditional) {
                        this.addError(`Parameter '${symbol.name}' is declared 'remote', `
                            + `but is also passed an ordinary array: the elements cannot be `
                            + `in another processor and in memory at the same time`, symbol.location);
                    }
                } else if (notes.register) {'''
assert s.count(old) == 1, s.count(old)
new = '''                if (symbol.arrayParamRep) continue;
                const declaredRemote = symbol.isRemote === true
                    || this.typeHasRemoteQualifier(symbol.myType?.());
                /*
                `remote int s[4]`: the elements are registers of another
                processor, so this parameter travels as a HANDLE. That has to be
                decided from the declaration alone -- a call through a function
                pointer gives no call-site information at all, yet the callee
                still has to agree on the form the array arrives in.
                */
                if (declaredRemote) {
                    symbol.arrayParamRep = 'handle';
                    if (notes?.traditional) {
                        this.addError(`Parameter '${symbol.name}' is declared 'remote', `
                            + `but is also passed an ordinary array: the elements cannot be `
                            + `in another processor and in memory at the same time`, symbol.location);
                    }
                    continue;
                }
                if (!notes) continue;
                if (notes.remote) {
                    symbol.arrayParamRep = 'handle';
                    if (notes.traditional) {
                        this.addError(`Parameter '${symbol.name}' is declared 'remote', `
                            + `but is also passed an ordinary array: the elements cannot be `
                            + `in another processor and in memory at the same time`, symbol.location);
                    }
                } else if (notes.register) {'''
s = s.replace(old, new, 1)

open(p, 'w', encoding='utf-8').write(s)
print('a declared-remote array parameter travels as a handle')
