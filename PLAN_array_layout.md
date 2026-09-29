# Array layout, handles, and the `vec` standard library

Working plan. Not committed yet — commit or delete at your convenience.

## 0. Inventory: what already records array implementation information

This is the constraint. **The same fact must not be recorded in two places.**

| axis | canonical field | values | decided in | cached |
|---|---|---|---|---|
| element layout | `symbol.chosenArrayStyle` | `{traditional \| embedded \| encoded} × {÷ divided \| lookup \| —}` | `arrayStyleFor` (generator) | yes |
| transport | `symbol.arrayParamRep` | `'handle' \| 'traditional' \| null` | `finalizeArrayParameters` (semantic) | — |
| request | `symbol.requestedArrayImplementation` | a *string request*, not a decision | declaration | — |
| remote-ness | `symbol.isRemote` / the `remote` qualifier | bool | declaration | — |
| const-ness | `symbol.isConst` | bool | declaration | — |
| aliasing | `symbol.arrayAliasOf` | `SymbolEntry` | semantic | — |

`selectArrayImplementation` (mindcInfrastructure.js:3588) is the layout decider; its
vocabulary is `{type, implement, reason}` where `type ∈ {traditional, embedded, encoded}`
and `implement ∈ {divided, lookup, null}`. `arrayStyleFor` (mindcGenerator.js:3433) is
the single accessor and caches into `symbol.chosenArrayStyle`.

### Verified: the transport axis is already binary

Every *write* to `arrayParamRep` yields only `'handle'`, `'traditional'` or `null`
(mindcSemantic.js:5083, 5558, 5822, 5845, 5850, 5857, 5864; mindcOptimizer.js:7291).
`'remote'` and `'names'` are **never written** — they are dead reads at
mindcGenerator.js:1517, 1518, 3444, 3445, 3529, 3530 and mindcSemantic.js:5778.

This confirms the design position: a `remote` array and an `embedded` array **are**
handles, and `arrayRetFor` (mindcGenerator.js:3529-3538) already treats all three labels
identically. The labels are just stale.

### Verified: handles are already the universal transport

`ensureArrayHandle` / `handleShapeOf` (mindcInfrastructure.js:3343 / 3265) describe
`RemoteArrayRet`, `LookupArrayRet`, `NameArrayRet` and `TraditionalArrayRet` (the last
with `kind: 'memory'`, block+pos). Every read/write of a handled array becomes a call
through the packed helper line numbers. Confirmed in generated code: a local
`remote int x[4]` emits `op and x 4095` (get) and `op shr x 12 / op and … 4095` (set),
then calls through them.

### The duplication that exists today

`arrayImplementationOf` (mindcSemantic.js:5766) **re-derives** layout+transport from
`requestedArrayImplementation` + `isRemote`, defaulting to `'memory'`. It exists only
because `chosenArrayStyle` is decided in the *generator*, which runs after the type
system. It invents a `'register'` value that has no counterpart in the canonical
taxonomy, and it is the sole reason the `null` escape hole exists under
`#pragma optimize(array)`.

### The real problem: a time-ordering problem, not a vocabulary problem

`chosenArrayStyle` is decided in the generator; the type system needs the answer
earlier. The fix is to **hoist the decision into semantic analysis** — where
`requestedArrayImplementation`, `isRemote`, `isConst`, the memory available and the
instruction budget are *already* all consulted by `finalizeArrayParameters` — and have
the generator read it instead of re-deciding. One decision, taken once, read by both.

**Therefore: no `representation` field is added to `TypeInfo`.** It would be a fourth
copy. The type system instead gets a *derived read* of the canonical fields.

---

## Phase 1 — Per-level qualifiers (foundation)

Blocker: type equality is decided by stringifying both `TypeInfo`s
(`isTypeCompatible`, ~6296). Any distinction the printer cannot show does not exist.
Printer first, then parsing.

- **1a** `TypeInfo.toString` (~687) must print `remote int *` and `int *remote`
  differently. **No new field needed**: each `pointerTo` level already owns its own
  `.qualifiers` and `toString`/`qualifiersOfTypeInfo` render them per level. The
  reporter (printer) part was already correct; what was wrong was the *writer*
  (parsing and the alias/declaration builders) never attached qualifiers to the
  level they were written on.
- **1b** `getTypeInfo` (1504-1591): the star-wrap loop sits *inside* the non-qualifier
  branch, so `"int *remote"` drops the `*` entirely; `"int *"` splits to `["int",""]`
  and returns `null` on the empty token; `result.qualifiers = existQualifiers` (1584)
  clobbers the base type's own qualifiers. Fix all three; attach a qualifier to the
  level it prefixes.
- **1c** `createAliasType` (1466) drops `pointerTo` —
  `new TypeInfo(baseType.name, baseType.kind, baseType.size, [...baseType.members])`.
  This is the `typedef int *p;` crash. Preserve `pointerTo` and per-level qualifiers.
- **1d** `isTypeCompatible` (6518-6532): move the null guard above the dereference.
  Add coverage for a typedef'd **data** pointer — every typedef in the corpus is a
  function pointer, which is why this survived.

Gate: `check.mjs` 148/0, `negative.mjs` 36/0/2, `nomem.mjs` 7/0.
Risk: touches `isTypeCompatible`, the most dangerous function here (it can recurse
infinitely via `RemoteArrayRet.convertTo` → `isSameType` → `typeToString`).

### Phase 1 status — DONE (uncommitted)

What it took (beyond the plan's four items):

- **1b** rewrote `getTypeInfo` (~1504): level-aware qualifier attachment
  (`levels + stars` rule: `*remote` goes on the pointer level, `remote int *` on the
  base), bare-`*` tokens no longer return null, `int[4]` / `int[]` dimensions are
  parsed in the same chunk (open dim = NaN), the base's own qualifiers are kept, and
  `byname` / `byvaluename` joined the qualifier list. `int *remote`, `remote int *`
  and `int *` now give three distinct chains (verified end-to-end through function
  signatures: `int* remote` / `remote int*` / `int*`).
- **Write side**: `getTypeNameFromTypeNode` (~3153) rebuilt each `*` with its own
  qualifiers (it used to print `"*".repeat(depth)` and silently dropped
  `*remote`), so the string channel no longer degrades `int *remote` to `int*`.
- **1c** `createAliasType` (~1466) now builds from `baseType.duplicate()` — the
  whole chain (pointerTo, per-level qualifiers, arraySize) survives, and typedef
  array dimensions go through `constantDimensionOf` like variable declarations
  (VLA typedefs are refused with a real message).
- **New crash found**: `visitVariableDeclaration` (~1881) built `varType` the same
  lossy way (`new TypeInfo(name, kind, size, [...]members)`) → `typedef int arr[4];
  arr a;` produced an array whose `arraySize` was `null` and crashed
  `TypeInfo.extractSingle` on first access. Now `baseType.duplicate()`.
- **1d** `isTypeCompatible` null guard moved above the dereference; the redundant
  in-place qualifier de-dup was deleted (already inside `duplicate()`).
- **Regression caught by the suite**: template-struct variant matching
  (`isStructVariantOf` → `isSameType`) compared member types by string after
  stripping qualifiers from the *top* level only; the old lossy parsing happened to
  make `auto int *` and `int *byname` read the same. With correct per-level
  parsing they no longer match, so `isSameType` now strips storage/representation
  qualifiers (`auto, static, extern, near, register, byname, byvaluename,
  volatile`) from **every** level — shape comparison stays representation-agnostic,
  the representation itself is still read off `namePointer` / the array style.
- Tests added (max test number 149 respected, free slots used): `check/t40`
  (typedef'd data pointer), `t41` (chained pointer typedef),
  `t42`/`t43` (typedef'd array, multi-dim), `negative/typedef_array_variable_length`.
- Two pre-existing bugs found, NOT Phase 1 scope, both reproduced at HEAD
  `25c058c`: (a) a call to a *declared-only* function with a real pointer argument
  crashes the optimizer (`Optimizer.analyzeFunction` reads `.scope` of null);
  (b) dereferencing a memory pointer whose element is also a memory pointer
  (`int **q; **q`) generates code that traps (reads through the wrong device).
  The dropped `t44` idea (`int *remote` typed variable) needs a peer processor —
  that is Phase 3/4 territory, deferred until then.

Gate now: `check.mjs` **152/0**, `negative.mjs` **37/0/2**, `nomem.mjs` **7/0**
(648 pragma-invariance runs).

## Phase 2 — `widthOfType` becomes representation-aware

`widthOfType` (mindcInfrastructure.js:153) is kind-based: `pointer`/`array` → 2. So
`int *byname` (one word) and a handle (one word) both report 2.

- **2a** lift the existing `namePointer` flag (`MemberInfo.namePointer` 1378,
  `forcedNamePointer` on symbols) onto the `TypeInfo`.
- **2b** make `widthOfType` consult it; a handle array is 1 word.
- **2c** add a `widthof` builtin **as a wrapper over `widthOfType`**, never
  independently — a program-visible `widthof` that disagrees with codegen is worse
  than none. `sizeof` keeps meaning "cells in memory" (frame offsets, `__step`,
  struct member offsets all depend on it); the two notions stay separate.

Rejected: making `size` layout-aware. `size` is genuinely "cells in memory" and is
used that way throughout.

### Phase 2 status — DONE (uncommitted)

How the design landed:

- **2a/2b** `widthOfType` (mindcInfrastructure.js ~180) now reads the per-level
  qualifiers as *the* `namePointer` fact (no new field): a `byname`/`byvaluename`
  pointer level is 1 word, `remote` is storage not width, a `remote` array and an
  open-dimension array are 1-word handles, everything else memory-shaped is 2.
- **2c** `widthof` = lexer token `WIDTHOF` + `parseSizeof(token, name)` (both
  builtins share the parser path; `readTypeName` now consumes full type names:
  `*` levels, `[N]`/`[]` dimensions, storage qualifiers, struct tags) + a
  compile-time fold wrapper over `widthOfType` (`foldCompileTimeFunction`, with a
  shared `resolveCompileTimeTypeName` for the type-name form). `sizeof` keeps
  meaning "cells in memory".
- **Type honesty fix (t87)**: `struct outer *byname w` with a struct that does NOT
  stay in registers (`addressedByName` unset) refuses the name representation —
  but the `byname` qualifier stayed on the type, and `widthOfType` answered 1 for
  a value that is really a block/offset pair, so `asRet` stopped wrapping the
  `_block`/`_pos` pair and `RefPointerRet.set` recursed infinitely. The semantic
  now strips `byname`/`byvaluename` from the type exactly when the name
  representation is not used; the type and the storage agree again.
- **Memory-byname member store fix (t127)**: a `*byname` member of a struct that
  lives in memory produced a temp-backed name pointer whose `set()` wrote only the
  temp — the cell never updated, and the 1-word width made the next read reuse the
  temp and clobber it with 0. The member lvalue is now a `MemoryNamePointerRet`
  (subclass of `NamePointerRet`, mindcInfrastructure.js) that writes the name back
  into the very cell it was read out of.
- Tests added (free slots, max 149 respected): `check/t13` (scalar basics, with
  `EMIT-NOT: widthof` to pin the fold), `t14` (pointer levels/qualifiers), `t15`
  (arrays, open dims), `t16` (register vs memory structs), `t17` (expression form
  on variables), `t25` (remote handles), `t32` (byname member of a memory struct,
  t127 tie-in), `t39` (unsized-array-parameter handle), `t44` (storage qualifiers
  don't change width), `t45` (`sizeof` cells vs `widthof` registers).

Gate now: `check.mjs` **162/0**, `negative.mjs` **37/0/2**, `nomem.mjs` **7/0**
(76 shape assertions, 698 pragma-invariance runs).

## Phase 3 — One decision point (replaces the old "representation on TypeInfo")

- **3a** Decide `chosenArrayStyle` in semantic analysis, not in the generator. Add a
  semantic-time `arrayStyleFor(symbol)` that reads the already-available facts
  (`requestedArrayImplementation`, `isRemote`, `isConst`, memory, budget, version) and
  stores the result in the *existing* `symbol.chosenArrayStyle`. The generator's
  `arrayStyleFor` becomes a reader.
- **3b** `arrayImplementationOf` (5766) stops re-deriving. It reads
  `chosenArrayStyle` + `arrayParamRep`; when they are genuinely undecided (the
  `optimize(array)` case) it says so explicitly instead of guessing `'memory'`.
  `'register'` is retired — the canonical taxonomy has no such value.
- **3c** Delete the dead `'remote'` / `'names'` reads (6 sites listed above).
- **3d** `isRequireMem()` (628) consults the canonical style, so a handled array is
  not given memory of its own. **This deletes the dead 4-cell block that every
  `remote` array currently allocates** (`set __step 4`, `x_block`/`x_pos`) and never
  uses.

Payoff: `refuseIncompatibleArrayAssignment` (ff35f88) becomes a comparison of the
canonical answers, and the `null === null` hole closes because "undecided" is now a
real, distinct state.

## Phase 4 — `&` resolution

`&` on a **memory array is correct today** and stays correct: a memory array has an
address, like a memory pointer.

The bug: `getExpressionType` case `'&'` (6393) unconditionally builds
`pointer to argType` of size 2. Verified wrong-code: `remote int x[4]` and `int x[4]`
generate **byte-identical** code — a local block+pos for an array whose elements are
on another processor.

Rule: **`&` takes the address of the variable's storage, and every variable has
storage.** A handle is one register; a `remote` array's handle is one local register.

| operand | `&` gives | width |
|---|---|---|
| memory array | `int[4]*` (block,pos) — already correct | 2 |
| handle array | pointer to the handle cell | 1 |
| remote array | pointer to the *local handle cell*, not the elements | 1 |
| register variable | name pointer, or the bare assembly name | 1 |

- **4a** `&` produces a representation-appropriate pointer.
- **4b** three-tier resolution for a callee that needs "a place to write": memory
  pointer → name pointer → bare assembly name. The third tier is what `ulocate` uses
  (mindcGenerator.js:4785) and it currently throws at mindcInfrastructure.js:1020
  (`address of a pointer`). `vecalias` is its first non-builtin consumer.
- **4c** `markVariableAsAddressed` (3921) needs an array branch — it has struct/union
  and `isRegister` branches and none for arrays.

Gate: a regression test asserting the remote `&x` code differs from the non-remote
case, plus a `&` matrix over memory / handle / remote / register.

## Phase 5 — `int a[];` as an unbound handle

Currently refused: *"The size of array 'a' is neither given nor deducible."*

- Make it a 1-word handle cell with length `NaN` until bound.
- Bound by `vecalias(&a, b)`, or by plain `a = b;`.
- An unbound handle must be provably unreadable: `a[i]` before binding is a compile
  error; a handle that escapes unbound traps at run time (precedent:
  `set null_block null; set null_pos null`).
- An `int a[];` that is never bound is a compile error.
- Cost: 1 register + `packHandle`'s 3-4 instructions. `&` adds no instructions — you
  pay `packHandle` either way, because either form needs a cell to write into.

## Phase 6 — `veccpy` / `vecalias`

Intrinsics, not a `.js` extension: `mindc.js` says `extensions (Currently not
working!!!)`, and `EXT_ROOT` points at a directory that does not exist. Precedent is
`array()`, `lenof`, `sizeof`, `byname` — all intrinsics.

- `vecalias(handle *dst, int b[])` — the `&` is right: a handle is one register, so
  the address of a handle is an ordinary pointer, the signature is the cheapest
  possible, and the body is one store.
- `veccpy(int a[N], int b[M])` — `M <= N` statically when both are static; a run-time
  check when a length is only in the packed handle.

Open decisions (flagged, not guessed):
- `b = a` with `a` remote, `b` local. Intend to keep refusing: a handle's helper line
  numbers mean nothing on another processor, so a remote→local handle copy yields a
  local handle whose get/set helpers are wrong. Remote↔local *element* copies (a loop
  of reads through the handle) would be allowed. Confirm this is the intended line.
- Whether `veccpy` accepts a handle destination (alias-copy) or stays element-wise
  into owned storage.

## Phase 7 — Test debt

- `MESSAGE:` on the 29 negative cases that lack it.
- Typedef'd **data** pointer coverage (the gap that hid Phase 1c).
- ~~The width/size matrix from Phase 2.~~ → added as `check/t13`–`t17`, `t25`, `t32`,
  `t39`, `t44`, `t45`.
- A remote-`&x` regression test.
- Out-of-bounds subscripting: `int r[3]; int s[] = r; s[5]=7;` **silently succeeds and
  prints 7.** A design question (C-like permissiveness vs. trapping), not a blind fix —
  the answer changes codegen for every subscript.

## Sequencing

Phase 1 first: 2-6 all need per-level qualifiers and a printer that can show them.
Phase 4 is the only phase fixing a shipping wrong-code bug (remote `&x`).

Seven commits, suite-green at each boundary. Baseline: `check.mjs` 148/0 (75 shape
assertions, 628 pragma-invariance runs), `negative.mjs` 36/0/2, `nomem.mjs` 7/0.
Invariant: no pragma may change program output. Max existing test number is 149.
