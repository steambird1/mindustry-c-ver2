# Array layout, handles, and the `vec` standard library

Working plan and design record for the array-representation work.

**Where it stands:** all seven phases are done and committed. Phase 3 landed as a
split rather than the hoist it started as (see Phase 3), and its 3d sub-item was
struck — the reasoning is in `OPEN_WORK.md` §1.4. Fixes that were not in the original
plan are recorded in [§8](#8-fixes-that-were-not-in-the-plan).

Baselines are recorded per phase. The current ones are in
[§9](#9-current-baselines).

## 0. Inventory: what already records array implementation information

This is the constraint. **The same fact must not be recorded in two places.**

| axis | canonical field | values | decided in | cached |
|---|---|---|---|---|
| element layout | `symbol.chosenArrayStyle` | `{traditional \| embedded \| encoded} × {÷ divided \| lookup \| —}` | `arrayStyleFor` — semantic for the declaration-visible classes, generator for the resource-dependent rest (the Phase 3 split) | yes |
| transport | `symbol.arrayParamRep` | `'handle' \| 'traditional' \| null` | `finalizeArrayParameters` (semantic) | — |
| request | `symbol.requestedArrayImplementation` | a *string request*, not a decision | declaration | — |
| remote-ness | `symbol.isRemote` / the `remote` qualifier | bool | declaration | — |
| const-ness | `symbol.isConst` | bool | declaration | — |
| aliasing | `symbol.arrayAliasOf` | `SymbolEntry` | semantic | — |

`selectArrayImplementation` is the layout decider; its vocabulary is
`{type, implement, reason}` where `type ∈ {traditional, embedded, encoded}` and
`implement ∈ {divided, lookup, null}`. `arrayStyleFor` is the accessor — the semantic
one (`mindcSemantic.js`, Phase 3a) settles what semantic time can see, the generator's
(`mindcGenerator.js:3740`) settles the rest and reads the shared cache first — and both
cache into the one `symbol.chosenArrayStyle`.

### Verified: the transport axis is already binary

Every *write* to `arrayParamRep` yields only `'handle'`, `'traditional'` or `null` —
there are 9 of them, and they are checkable by grep:

| site | writes |
|---|---|
| `mindcSemantic.js:2094`, `:6454`, `:6477`, `:6482`, `:6489` | `'handle'` |
| `mindcSemantic.js:6496` | `'traditional'` |
| `mindcSemantic.js:5562` | `'handle'` or `null` (ternary) |
| `mindcSemantic.js:6034` | `'traditional'` or `'handle'` |
| `mindcOptimizer.js:7429` | `null` |

`'remote'` and `'names'` are **never written** — they were dead reads at six
mindcGenerator.js sites (1540, 1541, 3752, 3753, 3837, 3838 at the time). **Removed in
Phase 3c (`2dc683e`).**

This confirms the design position: a `remote` array and an `embedded` array **are**
handles, and `arrayRetFor` already treats all three labels identically. The labels
are just stale.

### Verified: handles are already the universal transport

`ensureArrayHandle` / `handleShapeOf` describe `RemoteArrayRet`, `LookupArrayRet`,
`NameArrayRet` and `TraditionalArrayRet` (the last with `kind: 'memory'`, block+pos).
Every read/write of a handled array becomes a call through the packed helper line
numbers. Confirmed in generated code: a local `remote int x[4]` emits
`op and x 4095` (get) and `op shr x 12 / op and … 4095` (set), then calls through them.

### The duplication that used to exist

`arrayImplementationOf` (mindcSemantic.js) **re-derived** layout+transport from
`requestedArrayImplementation` + `isRemote`, defaulting to `'memory'`. It existed
only because `chosenArrayStyle` was decided in the *generator*, which runs after the
type system. It invented a `'register'` value that had no counterpart in the
canonical taxonomy, and it carried the `#pragma optimize(array)` → `null` branch —
which has no writer either (`OPEN_WORK.md` §3.5). **Removed in Phase 3b (`2dc683e`,
`8e54302`).**

### The real problem: a time-ordering problem, not a vocabulary problem

`chosenArrayStyle` is decided in the generator; the type system needs the answer
earlier. One decision, taken once, read by both. **Phase 3a landed that — as a split,
not the hoist this paragraph originally sketched**: two of the inputs named above
(memory available, instruction budget) and the lookup table are generation-time
quantities, so the classes that depend on them stay in the generator. What landed, what
was rejected and why, and the measured split are in Phase 3's section below.

**Therefore: no `representation` field is added to `TypeInfo`.** It would be a fourth
copy. The type system instead gets a *derived read* of the canonical fields.

---

## Phase 1 — Per-level qualifiers (foundation) — DONE

Commit `5d9c660`.

Blocker: type equality is decided by stringifying both `TypeInfo`s
(`isTypeCompatible`). Any distinction the printer cannot show does not exist.
Printer first, then parsing.

- **1a** `TypeInfo.toString` must print `remote int *` and `int *remote`
  differently. **No new field needed**: each `pointerTo` level already owns its own
  `.qualifiers` and `toString`/`qualifiersOfTypeInfo` render them per level. The
  reporter (printer) part was already correct; what was wrong was the *writer*
  (parsing and the alias/declaration builders) never attached qualifiers to the
  level they were written on.
- **1b** `getTypeInfo`: the star-wrap loop sat *inside* the non-qualifier branch, so
  `"int *remote"` dropped the `*` entirely; `"int *"` split to `["int",""]` and
  returned `null` on the empty token; `result.qualifiers = existQualifiers` clobbered
  the base type's own qualifiers. All three fixed; a qualifier now attaches to the
  level it prefixes.
- **1c** `createAliasType` dropped `pointerTo` —
  `new TypeInfo(baseType.name, baseType.kind, baseType.size, [...baseType.members])`.
  This was the `typedef int *p;` crash.
- **1d** `isTypeCompatible`: move the null guard above the dereference.

What it actually took, beyond those four items:

- **1b** rewrote `getTypeInfo`: level-aware qualifier attachment (`levels + stars`
  rule: `*remote` goes on the pointer level, `remote int *` on the base), bare-`*`
  tokens no longer return null, `int[4]` / `int[]` dimensions are parsed in the same
  chunk (open dim = NaN), the base's own qualifiers are kept, and `byname` /
  `byvaluename` joined the qualifier list. `int *remote`, `remote int *` and `int *`
  now give three distinct chains (verified end-to-end through function signatures).
- **Write side**: `getTypeNameFromTypeNode` now rebuilds each `*` with its own
  qualifiers (it used to print `"*".repeat(depth)` and silently dropped `*remote`),
  so the string channel no longer degrades `int *remote` to `int*`.
- **1c** `createAliasType` now builds from `baseType.duplicate()` — the whole chain
  (pointerTo, per-level qualifiers, arraySize) survives, and typedef array dimensions
  go through `constantDimensionOf` like variable declarations (VLA typedefs are
  refused with a real message).
- **New crash found**: `visitVariableDeclaration` built `varType` the same lossy way
  → `typedef int arr[4]; arr a;` produced an array whose `arraySize` was `null` and
  crashed `TypeInfo.extractSingle` on first access. Now `baseType.duplicate()`.
- **Regression caught by the suite**: template-struct variant matching
  (`isStructVariantOf` → `isSameType`) compared member types by string after
  stripping qualifiers from the *top* level only; the old lossy parsing happened to
  make `auto int *` and `int *byname` read the same. With correct per-level parsing
  they no longer match, so `isSameType` now strips storage/representation qualifiers
  (`auto, static, extern, near, register, byname, byvaluename, volatile`) from
  **every** level — shape comparison stays representation-agnostic, the
  representation itself is still read off `namePointer` / the array style.
- Tests added: `check/t40` (typedef'd data pointer), `t41` (chained pointer typedef),
  `t42`/`t43` (typedef'd array, multi-dim),
  `negative/typedef_array_variable_length`.

## Phase 2 — `widthOfType` becomes representation-aware — DONE

Commit `70c0e70`.

`widthOfType` is kind-based: `pointer`/`array` → 2. So `int *byname` (one word) and
a handle (one word) both reported 2.

- **2a** lift the existing `namePointer` fact onto the `TypeInfo`.
- **2b** make `widthOfType` consult it; a handle array is 1 word.
- **2c** add a `widthof` builtin **as a wrapper over `widthOfType`**, never
  independently — a program-visible `widthof` that disagrees with codegen is worse
  than none. `sizeof` keeps meaning "cells in memory" (frame offsets, `__step`,
  struct member offsets all depend on it); the two notions stay separate.

Rejected: making `size` layout-aware. `size` is genuinely "cells in memory" and is
used that way throughout.

How it landed:

- **2a/2b** `widthOfType` now reads the per-level qualifiers as *the* `namePointer`
  fact (no new field): a `byname`/`byvaluename` pointer level is 1 word, `remote` is
  storage not width, a `remote` array and an open-dimension array are 1-word handles,
  everything else memory-shaped is 2.
- **2c** `widthof` = lexer token `WIDTHOF` + `parseSizeof(token, name)` (both
  builtins share the parser path; `readTypeName` now consumes full type names:
  `*` levels, `[N]`/`[]` dimensions, storage qualifiers, struct tags) + a
  compile-time fold wrapper over `widthOfType` (with a shared
  `resolveCompileTimeTypeName` for the type-name form).
- **Type honesty fix (`check/t87`)**: `struct outer *byname w` with a struct that does
  NOT stay in registers (`addressedByName` unset) refuses the name representation —
  but the `byname` qualifier stayed on the type, and `widthOfType` answered 1 for a
  value that is really a block/offset pair, so `asRet` stopped wrapping the
  `_block`/`_pos` pair and `RefPointerRet.set` recursed infinitely. The semantic now
  strips `byname`/`byvaluename` from the type exactly when the name representation is
  not used; the type and the storage agree again.
- **Memory-byname member store fix (`check/t127`)**: a `*byname` member of a struct
  that lives in memory produced a temp-backed name pointer whose `set()` wrote only
  the temp — the cell never updated, and the 1-word width made the next read reuse
  the temp and clobber it with 0. The member lvalue is now a
  `MemoryNamePointerRet` (subclass of `NamePointerRet`) that writes the name back
  into the very cell it was read out of.
- Tests added: `check/t13` (scalar basics, with `EMIT-NOT: widthof` to pin the fold),
  `t14` (pointer levels/qualifiers), `t15` (arrays, open dims), `t16` (register vs
  memory structs), `t17` (expression form on variables), `t25` (remote handles),
  `t32` (byname member of a memory struct), `t39` (unsized-array-parameter handle),
  `t44` (storage qualifiers don't change width), `t45` (`sizeof` cells vs `widthof`
  registers). Later phases added `t118_addr_of_remote` and `t146_open_array_param`.

## Phase 3 — One decision point (replaces the old "representation on TypeInfo") — DONE

Commits `07636d0` (3a), `2dc683e` + `8e54302` (3b), `2dc683e` (3c). 3d was struck before
any code was written for it — the reasoning, and the two things this plan got wrong about
it, live in `OPEN_WORK.md` §1.4.

The design that landed is a **split, not a hoist**. OPEN_WORK §1.1 measured why: three of
`arrayStyleFor`'s nine inputs — `availableMemory`, `instructionBudget`, `lookupNames` —
are generation-time quantities that do not exist while semantic analysis runs. That
measurement is the basis for rejecting the two mechanisms this plan originally suggested:

- **Semantic-time `selectArrayImplementation` (old step 1) — rejected.** With the resource
  inputs left `undefined` they default to `availableMemory ?? Infinity` and
  `instructionBudget ?? 1000` (`mindcInfrastructure.js:3718`–`3719`), so the call returns
  `'memory available'` → `traditional` for **every** array regardless of length — including
  exactly the oversized arrays the automatic choice exists to move into registers. The one
  class the auto-choice is for would get the wrong answer, and semantic time would have
  nothing to correct it with.
- **`narrowArrayImplementation` (old step 2) — removed from the design.** With the
  automatic choice staying generator-side there is no semantic auto-answer to narrow:
  everything semantic analysis settles (parameter representation, `isRemote`, volatile, a
  non-lookup `array()` request) is final by construction. The generator's `arrayStyleFor`
  returns a cached semantic style as-is (`mindcGenerator.js:3745`–`3760`) with exactly one
  override, `forcedTraditionalReason` — recursion — and the comment at `:3746` records why
  parameter and `remote` shapes outrank even that. A separate narrowing pass would have
  been a fourth derivation of the same choice, which is what this phase exists to remove.
- **What did land instead (old steps 3–4).** A semantic-time `arrayStyleFor(symbol)` plus
  a new `finalizeArrayStyles()` pass that writes the *existing* `symbol.chosenArrayStyle`
  for the four classes whose facts exist then (parameter representation, `isRemote`,
  volatile, a non-lookup request); the generator keeps the inputs that are its own —
  memory budget, `isConst`/initial values, target version, lookup categories, recursion.
  The generator's memo read and the `narrow` position in the flow are the same code path:
  `chosenArrayStyle` set → return it (modulo `forced`).

**Measured where the split actually falls** — instrumented run over all 174
`check/*.c` (every one compiles and simulates; distinct array symbols by which side's
`arrayStyleFor` first returns a style for them, overlap 0):

| settled by | count | reasons |
|---|---|---|
| semantic analysis | **86** | 46 `array parameter`, 35 `requested`, 5 volatile |
| the generator only | **70** | 60 `memory available`, 8 `requested` (lookup categories — semantic deliberately returns styleless, `mindcSemantic.js:6281`), 1 recursion, 1 `out of memory` |

156 symbols split exactly along the design's line: everything the declaration says lands
at semantic time, everything the resources say stays in the generator.

Payoff status: `refuseIncompatibleArrayAssignment` now compares answers that cannot
disagree — after `8e54302`, `arrayImplementationOf` *reads* `arrayStyleFor` instead of
re-deriving. The second half of the promised payoff did **not** land: `null === null` is
not a real, distinct "undecided" state (`null` merges several differently-named layouts),
and the `#pragma optimize(array)` branch meant to produce it reads a flag nothing ever
sets. Both are recorded as `OPEN_WORK.md` §1.5 and §3.5.

## Phase 4 — `&` resolution — DONE

Commit `b1621ae`.

`&` on a **memory array is correct** and stays correct: a memory array has an
address, like a memory pointer.

The bug: `getExpressionType` case `'&'` unconditionally built `pointer to argType` of
size 2. Verified wrong-code: `remote int x[4]` and `int x[4]` generated
**byte-identical** code — a local block+pos for an array whose elements are on another
processor.

Rule: **`&` takes the address of the variable's storage, and every variable has
storage.** A handle is one register; a `remote` array's handle is one local register.

| operand | `&` gives | width |
|---|---|---|
| memory array | `int[4]*` (block,pos) | 2 |
| handle array | pointer to the handle cell | 1 |
| remote array | pointer to the *local handle cell*, not the elements | 1 |
| register variable | name pointer, or the bare assembly name | 1 |

- **4a** `&` produces a representation-appropriate pointer.
- **4b** three-tier resolution for a callee that needs "a place to write": memory
  pointer → name pointer → bare assembly name. The third tier is what `ulocate` uses.
  `vecalias` is its first non-builtin consumer.
- **4c** `markVariableAsAddressed` needs an array branch.

Deliberate non-decisions, kept: a handle cannot cross processors (the packed get/set
helpers are local line numbers); `&` on a handle is not refused; remote / register /
embedded arrays are handles unless inlined; `vecalias(&a, b)` keeps the `&`.

## Phase 5 — `int a[];` as an unbound handle — DONE

Commit `daf1eb0`.

Previously refused: *"The size of array 'a' is neither given nor deducible."*

- `int a[];` (no initializer) is a 1-word handle cell, length `NaN` until bound.
- Bound by `a = b;` or by `vecalias(&a, b);`.
- `a[i]` before binding is a compile error.
- A handle that escapes unbound traps at run time (precedent:
  `set null_block null; set null_pos null`).
- An `int a[];` that is never bound is a compile error.
- Cost: 1 register + `packHandle`'s instructions. `&` adds no instructions — you pay
  `packHandle` either way, because either form needs a cell to write into.

## Phase 6 — `veccpy` / `vecalias` — DONE

Commit `a23e3c9`.

Intrinsics, not a `.js` extension: `mindc.js` says `extensions (Currently not
working!!!)`, and `EXT_ROOT` points at a directory that does not exist. Precedent is
`array()`, `lenof`, `sizeof`, `widthof`, `byname` — all intrinsics.

- `vecalias(handle *dst, int b[])` — the `&` is right: a handle is one register, so
  the address of a handle is an ordinary one-word pointer, the signature is the
  cheapest possible, and the body is one store.
- `veccpy(int a[N], int b[M])` — `M <= N` statically when both are static; a run-time
  clamp when a length lives only in a packed handle.

Implementation notes worth keeping:

- Both are registered as **builtins** (parser `isBuiltinFunction` +
  `initializeBuiltinFunctions` with `special` and `hasVarArgs: true`) to bypass
  argument-delivery aliasing.
- `vecalias` binds only a cell the program **owns** (`isUnboundHandle === true`),
  detected as `staticArrayLengthOf(cell) === null`.
- `emitVecAlias` writes to `NamePointerRet.targetName` — the **cell**, not `.name`.
  A handle source is a single `set`; otherwise `ensureArrayHandle` + `packHandle`.
- `emitVecCopy` loops on `destination.element(i).set(source.element(i).get())` with
  `{goto_test}` / `{loop_break}` referrers. One loop for every layout pair, because
  both sides go through the same `element(i)` machinery a subscript uses.
- Jump conditions are comparisons, not bare registers: `equal <verdict> false`.

Decisions taken (all were flagged in the plan rather than guessed):

- `b = a` with `a` remote and `b` local stays **refused**. A handle's helper line
  numbers mean nothing on another processor, so a remote→local handle copy yields a
  local handle whose get/set helpers are wrong.
- `veccpy` stays element-wise into owned storage, and a handle **destination is
  refused**. `vecalias` into a handle *parameter* is refused too.
- Assigning an **open-dimension array parameter** (`int s[]`, a by-value handle) is
  **refused** (§3.7/§7.5): it can only rebind the callee's copy. Writing elements
  (`s[i] = ...`) is the supported path, and a sized parameter (`int s[4]`) keeps the
  §3.6 element copy. `check/t167` pins the element-write path under every invariance
  pragma.
- A **sized** array parameter that receives a bound unbound handle arrives as a handle
  too (`check/t168`): the call-site note follows the argument's one-word packed value
  instead of assuming a traditional pointer. A function passed both a memory array and
  a handle is refused with the existing "no layout in common" message.
- Writing through an array **alias** (`int al[] = mem;`) follows `arrayAliasOf` to the
  target in the optimizer, so a constant-initialized target is not promoted to an
  encoded table and its elements do not fold back; an explicit encoded target is
  refused semantically (`check/t169`, `negative/alias_write_into_constant_refused`).

Tests: `check/t152`–`t156` and `t167` for the working forms, and nine
`negative/vec*` / `array_*` cases for the refusals — `vecalias_into_parameter`,
`vecalias_into_storage`, `vecalias_needs_address`, `vecalias_remote_source`,
`veccpy_into_handle`, `veccpy_never_bound_source`, `veccpy_source_too_long`,
`vec_intrinsic_arity` and `array_parameter_assignment_refused`.

## Phase 7 — Test debt — DONE

Commits `1584cf3` (the `MESSAGE:` annotations, the runner's `NOT-MESSAGE:`, the
zero-candidate overload case) and `245c163` (the last two tests). As measured:

- **`MESSAGE:` debt — cleared.** All 28 carry `MESSAGE:` lines taken from the compiler's
  own wording (regex-escaped, short unique prefixes); the two `KNOWN-GAP`s that stood
  then (`ovl_auto.c`, `ovl_pragma.c`) have since been removed — auto templates made those
  programs legal and `check/t109`/`t110` cover them, so `negative/` states a reason for
  every case. `negative.mjs` gained `NOT-MESSAGE:`, and
  `negative/ovl_shared_noversion.c` uses it to pin the zero-candidate refusal's silence
  about the count message. The list is in §9 and in
  [`testers/INFO.md`](../testers/INFO.md).
- **Typedef'd data pointer, second half — done as
  `check/t160_typedef_data_pointer_alias.c` (`245c163`).** The re-check found no
  accidental coverage: no test from Phases 5 or 6 contains a `typedef` at all. The test
  walks alias-of-alias (copy path, no pointer wrap), the typedef'd pointer as a parameter
  written through, an element of a local array, and a pointer to a typedef'd array. The
  global-array shape (`&arr[i]` on a global) was excluded on purpose while it was broken;
  §3.4 has since fixed it and `check/t166` pins it, so `t160`'s header now points there.
- ~~The width/size matrix from Phase 2.~~ → done, `check/t13`–`t17`, `t25`, `t32`,
  `t39`, `t44`, `t45`.
- **Remote-`&x` difference regression — done as `check/t161_remote_addr_diff.c`
  (`245c163`).** The difference itself, from both directions: `widthof` constant-folds
  into the emitted `print`, so the `EMIT` lines *are* the widths (1 for the remote
  address, 2 for a memory pair — Phase 4's bug made both `print 2`), and three
  `EMIT-NOT`s forbid either side taking the other's form. `t118` keeps the per-side
  positive assertions; t161 asserts the difference, with distinct names.
- **Out-of-bounds subscripting — done (`8d8fb43`)**: the static half, where the length
  is already known. `OPEN_WORK.md` §7.4 records the measurement (no driven case had a
  constant out-of-range index) and what stays unchecked — the dynamic subscript, and a
  pointer or unbound handle whose length does not exist at compile time.

## 8. Fixes that were not in the plan

### `e6ba968` — `ReferenceError: Cannot access 'Instruction' before initialization`

`main.html` imports `mindcLexer.js` → `mindcGeneratorBase.js` → `mindc.js`, and
`mindcInfrastructure.js` reads `Instruction` (`class VariableRet extends
Instruction`) at module-evaluation time. Node always enters via `mindc.js`, so this
was unreachable from the command line and only fired in the browser.

Fixed by extracting the instruction classes into a new leaf, `mindcInstruction.js`,
which imports only `mindcBase.js`; `mindcGeneratorBase.js` re-exports them. Chosen
over reordering `main.html` because it makes import order irrelevant rather than
merely correct. `Instruction` is the only superclass in the repo that originates
outside `mindcInfrastructure.js`.

`testers/tools/loadorder.mjs` guards it: **one `node` process per entry point**. A
single process looping over entries with a cache-busting query is unsound — the first
import warms the shared subgraph, and the guard was empirically shown to report the
unfixed tree as PASSING. `mindcCompileWorker.js` and `mindcHighlightWorker.js` are
exempt (they need `self`).

### `add2f5d` — `canOptimize` and `EVAL_TRACKED`

`addWrittenSymbol` decides `usage.canOptimize`, which gates whether a later read may
be folded to a constant. The gate was `resolved !== EVAL_UNKNOWN`, so a **TRACKED**
write (occurrence known, value not — what a loop body produces) still cleared it.

An attempt to relax this to `resolved === EVAL_DEFINITE` dropped the TRACKED case
entirely. Consequence: a declaration inside a loop body counted as foldable, its
initialising store was deleted, and a later read took whatever the register happened
to hold. `gcd(28, 35)` returned `0`; in `t10_big` the same defect made a `while`
loop diverge into a step-limit trap; `t53` crashed the optimiser with an empty
error list.

The shipped condition is one rule per state — `UNKNOWN` is never foldable,
everything else trusts `valueKnown` — which keeps a TRACKED-but-known value foldable
(the original intent of the attempt) without losing the loop-body safety net. Pinned
by `check/t157_loop_local_init.c` and `check/t158_inline_in_loopbody_noreport.c`.

A second hunk in the same commit wraps `doUpdate` in `resolveWriteState` before
passing it to `addWrittenSymbol`. That is a **provable no-op**: `addWrittenSymbol`
already normalises that argument itself, and `resolveWriteState` is idempotent over
all seven of its inputs.

### `94f5737` — a call with too many arguments crashed the compiler

```c
int add(int a, int b)        { return a + b; }
int add(int a, int b, int c) { return a + b + c; }
int main() { return add(1, 2) + add(1, 2, 3); }
```

`TypeError: Cannot read properties of undefined (reading 'type')` out of
`visitFunctionCall`, surfacing as a `fatalError` with an **empty error list** rather than
as a diagnostic. The overloading was incidental: a single `int add(int a, int b)` called
as `add(1, 2, 3)` does it with no overloads in the program at all.

Both halves of the defect predate the array work. The read that goes out of bounds and
the count check that should have caught it are both from `52fd9f5` (2026-08-19), and
overload support (`9ff9395`, 2026-09-22) left the ordering alone. Nothing here is
attributable to a phase.

Two separate things were wrong, and the report conflated them:

1. **The count was checked after the arguments were walked.**
   `expectedParams[index].type` was read for every argument before the count was
   compared. The asymmetry is why it went unnoticed: too FEW arguments was always
   reported properly, because the walk only reads as far as the argument list goes, so a
   short parameter list is harmless. Only a long one is fatal, and only in the rarer
   direction.
2. **Overload resolution was circular.** `resolveOverloadedCall` picks by type and needs
   the arguments visited; visiting needs a parameter list to take each expected type
   from. Neither could go first, and the comment above the call described the cycle as
   though it were a sequence. `prescanFunctionDeclarations` mangles every version but the
   first to `name__ov1`, `name__ov2`, so a name lookup finds only one of them — the
   2-parameter `add` — and `add(1, 2, 3)` was measured against it.

Fix: `preselectOverloadByArity` narrows the set by argument count before the walk, which
is the one fact available from the syntax alone. Type-based resolution still runs after
and still decides what the count cannot, so same-arity type overloads are unchanged. Two
guards came with it: the walk no longer reads out of bounds (an argument with no
parameter is visited with no `givenType`, which both consumers already test for), and a
shared name no longer also gets one version's count quoted at it when
`resolveOverloadedCall` has already named every version it tried.

Tests: `check/t159_overload_by_arity.c` and `negative/fn_arity_mismatch.c`. Both were
run against the unmodified compiler and both fail — t159 with a compile error, and
`fn_arity_mismatch` with "refused, but with no message", which is the state the crash
produced and the state no `MESSAGE:` assertion can catch.

## 9. Current baselines

Reproduce from `testers/unit_tests`:

| harness | result |
|---|---|
| `node ../tools/check.mjs` | 220 passed, 0 failed (140 shape assertions, 975 pragma-invariance runs) |
| `node ../tools/negative.mjs` | 75 passed, 0 failed |
| `node ../tools/nomem.mjs` | 7 passed, 0 failed |
| `node ../tools/loadorder.mjs` | 12 passed, 0 failed, 2 exempt |
| `node ../tools/runall.mjs` | 267/275 — the 8 misses are known gaps, reported on their own line |

Invariants that must hold at every boundary:

- No pragma may change program output. Every `check/` case is re-run under each
  `optimize(...)` variant; none currently opts out.
- Never record the same fact twice, and never let a test assert a fact another test
  already asserts.
- Every `negative/` case states its refusal with `MESSAGE:`
  (and must stay silent with `NOT-MESSAGE:` where silence is the point) — the
  annotations themselves are the record.

Test numbering: `check/` runs `t1`–`t207` with **no free slot**, so the next case is
`t208`. (`negative/` is named by behaviour, not by number.)

### The Phase 7 `MESSAGE:` debt — cleared in `1584cf3`

The list below is the 28 that had no annotation when Phase 7 closed; each now carries a
`MESSAGE:` line. The reasoning behind each annotation is in
[`testers/INFO.md`](../testers/INFO.md).

**No `KNOWN-GAP`s remain.** The two that stood (`ovl_auto.c`, `ovl_pragma.c`) were
removed once auto templates made them legal; `check/t109` / `t110` cover them.

**The other 28, then without annotations:**

`array_no_address_to_function_pointer`, `array_param_too_small`,
`byname_needs_v150`, `byname_of_array_element`, `byname_of_volatile`,
`byname_pointer_arithmetic`, `byname_target_needs_two_representations`,
`lookup_capacity`, `n05_const_pointer_qualifiers`, `n06_variable_length_array`,
`n07_runtime_string_concat`, `n08_string_concat_runtime`, `n09_lenof_pointer`,
`n10_conditional_string_concat`, `nomem_pointer_needs_memory`,
`nomem_storage_class_pointer`, `nomem_undereferenced_pointer`,
`remote_array_no_length`, `remote_array_two_dimensions`, `remote_of_remote`,
`remote_struct_pointer_needs_pragma`, `struct_name_packet_needs_byname`,
`struct_template_conversion_mismatch`, `struct_template_pointer_needs_byname`,
`t25_opaque_reject`, `t32_encoded_bad`, `template_struct_in_function_pointer`,
`typedef_array_variable_length`.

---

## 10. What the user sees

This document is a design record. The language-level description of what landed is
in [`TYPES_AND_FUNCTIONS.md`](TYPES_AND_FUNCTIONS.md) — the "Array Handles" section
covers `int a[];`, `widthof` and the `vec*` intrinsics; the "Major Differences"
list in [`README.md`](README.md) links to it.
