p = '/data/workspace/src/mindcSemantic.js'
s = open(p, encoding='utf-8').read()

# ---- 1. defer an unresolved remote target instead of failing ----
old = '''		if (!targetSymbol) {
			this.addError(`'${inner.name}' is not declared, so it cannot be reached remotely`, location);
			declarator.initializer = null;
			return;
		}'''
assert s.count(old) == 1, s.count(old)
new = '''		if (!targetSymbol) {
			/*
			Not declared YET: `remote int ru[] = remote(p1, u);` may well appear
			before `int u[4];`. Nothing about this binding can be decided before
			the whole program is read, so remember it and try again once it has
			been -- see `finalizeRemoteLinks`.
			*/
			if (targetNode.type !== 'StringLiteral' && targetNode.type !== 'UnaryExpression') {
				(this.pendingRemoteLinks ??= []).push({ declarator, symbol, finalType, qualifiers });
				return;
			}
			this.addError(`'${inner.name}' is not declared, so it cannot be reached remotely`, location);
			declarator.initializer = null;
			return;
		}'''
s = s.replace(old, new, 1)

# ---- 2. capacity / consistency helpers ----
anchor = '''    /**
     * The dimensions of an array type, outermost first.'''
assert s.count(anchor) == 1
helpers = '''    /**
     * How many elements a lookup table can name, and their names.
     *
     * @param {string} category item | liquid | unit | building
     * @returns {string[]}
     */
    lookupNamesFor(category) {
        const table = this.contentTable;
        if (!table?.namesOf) return [];
        const wanted = (category === 'building') ? 'block' : category;
        return (table.namesOf(wanted) ?? []).map(n => String(n).replace(/^@/, ''));
    }

    /**
     * `array("embedded_lookup_item", ...)` names its elements after contents,
     * so it cannot hold more elements than that table has names for. Without
     * this check the extra elements silently read as 0.
     *
     * @param {string} name The array's name, for the message
     * @param {string} category item | liquid | unit | building
     * @param {number} length
     * @param {any} location
     * @returns {void}
     */
    checkLookupCapacity(name, category, length, location) {
        const names = this.lookupNamesFor(category);
        if (!names.length && !this.contentTable) return;	// no table: nothing to check
        if (length > names.length) {
            this.addError(`Array '${name}' has ${length} elements, but the '${category}' `
                + `lookup table only names ${names.length}: use at most ${names.length}, `
                + `or another implementation such as array("embedded_divided", ...)`,
                location);
        }
    }

    /**
     * Which lookup table an array implementation string asks for.
     *
     * @param {string?} requested
     * @returns {string?} item | liquid | unit | building, or null
     */
    lookupCategoryOf(requested) {
        if (!requested || !String(requested).startsWith('embedded_lookup_')) return null;
        const CATEGORY_ALIASES = {
            item: 'item', liquid: 'liquid', unit: 'unit', block: 'building', building: 'building'
        };
        return CATEGORY_ALIASES[String(requested).slice('embedded_lookup_'.length)] ?? null;
    }

''' + anchor
s = s.replace(anchor, helpers, 1)

# ---- 3. check capacity where the layout is requested ----
old = '''		declarator.setAttribute('arrayImplementation', requested);
		symbol.requestedArrayImplementation = requested;'''
assert s.count(old) == 1
new = '''		declarator.setAttribute('arrayImplementation', requested);
		symbol.requestedArrayImplementation = requested;
		/*
		An array named after a lookup table can only be as long as that table.
		*/
		const category = this.lookupCategoryOf(requested);
		if (category) {
			this.checkLookupCapacity(symbol.name, category,
				this.arrayDimensionsOf(symbol.myType?.())[0] ?? 0, initializer.location);
		}'''
s = s.replace(old, new, 1)

# ---- 4. remote array: capacity and a matching layout on both sides ----
old = '''			const requested = targetSymbol.requestedArrayImplementation ?? null;
			if (requested === null) {
				targetSymbol.requestedArrayImplementation = 'embedded_divided';
			} else if (requested === 'encoded' || requested === 'traditional') {'''
assert s.count(old) == 1
new = '''			const requested = targetSymbol.requestedArrayImplementation ?? null;
			/*
			The layout belongs to BOTH sides: the remote declaration may name it
			(the third argument of remote()), and the array itself may. Agreeing
			is what makes `ru[1]` mean the same register on both processors.
			*/
			if (layout && requested && layout !== requested) {
				this.addError(`'${targetSymbol.name}' is declared array("${requested}"), `
					+ `but remote() asks for "${layout}": the two processors have to agree `
					+ `on the layout`, location);
			}
			if (requested === null) {
				/*
				Nothing was asked for, so the layout is chosen automatically --
				and an automatically chosen `lookup` table is exactly what two
				processors may guess differently. Pick the plain register layout
				instead: it only needs the array's own name, which both sides
				already share.
				*/
				targetSymbol.requestedArrayImplementation = layout ?? 'embedded_divided';
			} else if (requested === 'encoded' || requested === 'traditional') {'''
s = s.replace(old, new, 1)

old = '''			} else if (requested === 'embedded_lookup') {'''
assert s.count(old) == 1
new = '''				} else if (this.lookupCategoryOf(requested)) {
					/*
					Allowed, and the table is named -- but the array may not be
					longer than that table, or the extra elements would read as 0.
					*/
					const effective = layout ?? requested;
					const category = this.lookupCategoryOf(effective);
					if (category) {
						this.checkLookupCapacity(targetSymbol.name, category,
							this.arrayDimensionsOf(targetSymbol.myType?.())[0] ?? 0, location);
					}
				} else if (requested === 'embedded_lookup') {'''
s = s.replace(old, new, 1)

# ---- 5. finalizeRemoteLinks, called at the end of analyze() ----
old = '''        /*
        Only now is every call site known, so only now can each array parameter
        be told which layout it will be given.
        */
        this.finalizeArrayParameters(ast);'''
assert s.count(old) == 1
new = '''        /*
        Only now is the whole program read, so only now can a `remote()` that
        mentions an array declared further down be bound.
        */
        this.finalizeRemoteLinks();
        /*
        Only now is every call site known, so only now can each array parameter
        be told which layout it will be given.
        */
        this.finalizeArrayParameters(ast);'''
s = s.replace(old, new, 1)

anchor2 = '''    /**
     * Turn the notes collected at every call site into one decision per array
     * parameter. Called once, after the whole program has been visited.'''
assert s.count(anchor2) == 1
fin = '''    /**
     * Bind the `remote()` directives whose array was declared further down.
     *
     * @returns {void}
     */
    finalizeRemoteLinks() {
        const pending = this.pendingRemoteLinks ?? [];
        this.pendingRemoteLinks = [];
        for (const entry of pending) {
            this.consumeRemoteDirective(entry.declarator, entry.symbol, entry.finalType,
                entry.qualifiers);
        }
        for (const entry of (this.pendingRemoteLinks ?? [])) {
            this.addError(`The variable of remote() is not declared anywhere in this program`,
                entry.declarator?.location ?? null);
        }
        this.pendingRemoteLinks = [];
    }

''' + anchor2
s = s.replace(anchor2, fin, 1)

# ---- 6. initialise the list ----
old = '''    analyze(ast) {
        this.errors = [];
        this.warnings = [];'''
assert s.count(old) == 1
s = s.replace(old, '''    analyze(ast) {
        this.errors = [];
        this.warnings = [];
        // `remote()` bindings that name an array declared further down
        this.pendingRemoteLinks = [];''', 1)

open(p, 'w', encoding='utf-8').write(s)
print('semantic patched (remote links + capacity)')
