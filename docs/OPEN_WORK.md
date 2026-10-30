# Open work

What is still undone, measured rather than estimated, with a suggested
implementation where one is obvious.

This is a companion to [`PLAN_array_layout.md`](PLAN_array_layout.md), which records
what the array-layout phases did and why. That document is a design record for one
piece of work; this one is the outstanding list, and it is not limited to array layout.
Where the two overlap, this one is the one to trust for status �?auditing it turned up
three claims in the plan that did not survive checking, all corrected in place and
marked below.

Everything here was measured against `94f5737`, re-checked at `f391690`, and the status
rows below were refreshed at `245c163` �?every suite was re-run then, and the defects in
§3.3–�?.6 were each re-measured against `2dc683e` (before this work's phases) to confirm
none of them was caused by a phase. Line numbers drift; symbol names do not, so each item
cites both and the symbol is the thing to grep for.

Reproduce the baselines from `testers/unit_tests`:

| runner | result |
|---|---|
| `node ../tools/check.mjs` | 186 passed, 0 failed (114 shape assertions, 817 pragma-invariance runs) |
| `node ../tools/negative.mjs` | 64 passed, 0 failed |
| `node ../tools/nomem.mjs` | 7 passed, 0 failed |
| `node ../tools/loadorder.mjs` | 12 passed, 0 failed, 2 exempt |
| `node ../tools/runall.mjs` | 267/275 — the 8 misses are reported as known gaps, not failures |

The two invariants any new work has to keep:

- **No pragma may change program output.** Every `check/` case is re-run under each
  `optimize(...)` variant; none opts out.
- **Never record the same fact twice.** A test that asserts what another test already
  asserts is a test that will keep passing after the thing it guards is deleted.

## Where everything stands

One line per item, so this file can be read a piece at a time. The reasoning is where the
last column says, and the order of work is the order of the rows: **§1, §2 and §3 are
closed** — their work rows read done or struck, and §1.5 records what the closure left
open. What remains is the known gaps recorded in §6 and `testers/INFO.md`.

| item | state | detail |
|---|---|---|
| 3a �?decide `chosenArrayStyle` at semantic time | **done** �?`07636d0`; a split, not a hoist | §1.1 |
| 3b �?`arrayImplementationOf` reads the decision | **done** �?`2dc683e` + `8e54302` | §1.2 |
| 3c �?delete the six dead `'remote'` / `'names'` reads | **done** �?`2dc683e` | §1.3 |
| 3d �?`isRequireMem()` consults the canonical style | **struck �?do not implement** | §1.4 |
| the `null === null` comparison the payoff left open | **done** �?`2dbb911`; a named layout answers its own name | §1.5 |
| Phase 7: `MESSAGE:` on the 28 negative cases | **done** �?`1584cf3` | §2.1 |
| typedef'd data pointer, second half | **done** �?`245c163`, `check/t160` | §2.2 |
| remote-`&x` difference regression | **done** �?`245c163`, `check/t161` | §2.3 |
| out-of-bounds subscript | **done** — `8d8fb43`; a constant index is refused where the length is known at compile time | §7.4 |
| a case for the zero-candidate overload refusal | **done** �?`1584cf3` | §2.5 |
| `'x'` loses its text (§3.1) | **done** �?`0784da0`, `check/t162`; int→char is now a clean refusal | §7.1, §3.1 |
| `for (int i = 0; �?` (§3.2) | **done** �?`189f546`, `check/t163`; every clause may be empty, the init declaration is scoped to the loop | §7.2, §3.2 |
| both `stackcheck` overflow paths trap (§3.3) | **done** �?`9cbaf8c`; both overflow paths stop cleanly, so1/so2/so3 all clean | §3.3 |
| &global_array[i] / &global_struct.field (§3.4) | **done** — mindcGenerator.js pair init + static struct-store at boot | §3.4 |
| `compiler.arrayOptimize` reads a flag nobody sets (§3.5) | **done** �?`c9dd030`; the two dead reads are deleted, the flag is not wired | §3.5 |
| same-layout array assignment does not copy (§3.6) | **done** �?`e74df68`; same-layout pairs copy, an encoded target is refused | §3.6 |
| assigning an open-dimension array parameter (§3.7) | **done** — `613cafa`; refused at semantic time, element writes stay supported | §7.5, §3.7 |
| sized array parameter receiving a bound handle (§3.8) | **done** — `f970d51`; the call-site note follows the argument's packed handle | §7.6, §3.8 |
| element writes through an array alias (§3.9) | **done** — `e13d454`; the optimizer follows `arrayAliasOf`, encoded/const targets are refused cleanly | §7.7, §3.9 |
| `break` / `continue` outside a loop (§3.10) | **done** — `d34951c`; semantic context counters | §7.8, §3.10 |
| `do ... while` (§3.11) | **done** — `4f44071`; parser/semantic/generator + deterministic optimization | §7.9, §3.11 |
| `switch ... case` (§3.12) | **done** — `eaa54f6`; fallthrough + comparison dispatch, break/continue contexts | §7.10, §3.12 |
| `m = remote(@this, r)` (§6) | **done** �?`be3aeb8`, `negative/remote_as_value_refused.c`; `remote()` is a binding form and is refused as a value | §7.3, §6 |
| §4 harness debt | **closed** — `2dc683e` fixed the roots; §4.4's note was stale | §4 |

---

## 1. Phase 3 �?the canonical array decision

**All four are disposed of.** The plan recorded 3b as done early; that was wrong when
written, and §1.2 below says what it had actually achieved then and what closed it. What
landed: 3a as a split, not a hoist (`07636d0`); 3b in two steps (`2dc683e`, `8e54302`);
3c (`2dc683e`); 3d struck (§1.4). The sections below keep the measurements that shaped
each decision �?they are why the implementations look the way they do �?and each now ends
with what was done about it. One promise from §1.1's verification did not land, and it is
written down as §1.5.

### 1.1 3a cannot be done as written: the inputs do not exist yet

> Decide `chosenArrayStyle` in semantic analysis, not in the generator.

The premise is that `arrayStyleFor` (`mindcGenerator.js:3752`–`3815`) is a pure function
of facts semantic analysis already has, and can simply be hoisted. It cannot. Three of
its nine inputs are **generation-time** quantities that do not exist while semantic
analysis runs:

| input | needs | available at semantic time? |
|---|---|---|
| `length`, `size`, `isConst`, `values` | the symbol | yes |
| `requested` | `requestedArrayImplementation` | yes |
| `targetVersion` | config | yes |
| `availableMemory` | `remainingMemory()` (`mindcGenerator.js:3634`) and `symbol.memoryAllocationFailed`, set at `mindcGenerator.js:719` and `:743` | **no** �?it depends on how much memory earlier symbols already took |
| `instructionBudget` | `instructionBudget()` (`mindcGenerator.js:3648`) �?a running "instructions still available" counter | **no** |
| `lookupNames`, `lookupUnavailable` | `lookupNamesOf()` (`:3659`), `lookupUnavailable` (`:3700`, driven by `contentTable.hasOverrides`, which `mindc.js:516` only sets once the content table is built) | **no** |

So the honest shape of 3a is not a hoist. It is a **split**: decide everything that is
knowable during semantic analysis, and let the generator only *narrow* the result.

Suggested implementation:

1. Add a semantic-time `arrayStyleFor(symbol)` that handles `arrayParamRep`, `isRemote`,
   `forcedTraditionalReason` and `requestedArrayImplementation`, and calls
   `selectArrayImplementation` with the three resource inputs left `undefined`.
2. Give `selectArrayImplementation` (`mindcInfrastructure.js:3713`) a second entry point,
   `narrowArrayImplementation(style, { availableMemory, instructionBudget, lookupNames })`,
   that may only move a decision *towards* `traditional` �?never away from it. That
   direction is the safe one: memory running out can force an array out of registers,
   but registers cannot be conjured back after the fact.
3. The generator's `arrayStyleFor` becomes `narrowArrayImplementation` plus a memo read.
4. `symbol.chosenArrayStyle` becomes a semantic-time fact, which is what 3b and 3d both
   need.

**Verify it by** the thing that makes the split worth doing: `refuseIncompatibleArrayAssignment`
(`mindcSemantic.js:4253`) currently compares two independently-derived answers, so it can
compare `null === null` and admit a program it should refuse. After the split both sides
read the same fact, and that hole closes. `null === null` becoming a real "undecided"
state is the other half of the payoff, and it only works because the generator can no
longer be the only place that knows.

**Done in `07636d0`** �?as the split, not the hoist: semantic time settles exactly the
four classes that exist at semantic time (parameter representation, `isRemote`, volatile,
a non-lookup `array()` request) in a new `finalizeArrayStyles()` pass, and the generator
keeps everything whose inputs are its own (memory budget, initial values, `lookup`
categories, recursion). What the final design rejected about the suggested implementation
above �?semantic-time `selectArrayImplementation` and the `narrowArrayImplementation`
half �?and the measurements behind that rejection are in the plan's Phase 3 section.
The verification's first half landed: after `8e54302`, `arrayImplementationOf` and
`arrayStyleFor` read each other and cannot disagree. The second half �?`null === null`
becoming a real, distinct state �?did **not** land, and §1.5 writes down what is
actually reachable.

### 1.2 3b �?`arrayImplementationOf` still re-derives

> `arrayImplementationOf` stops re-deriving; `'register'` is retired.

`arrayImplementationOf` exists, at `mindcSemantic.js:6242`, with five call sites
(`:4253`, `:4254`, `:4353`, `:4402`, `:4449`). Measured against the item's own wording:

- it reads `arrayParamRep` �?**yes**;
- it reads `chosenArrayStyle` �?**no**. That field is generator-local: written only at
  `mindcGenerator.js:3772`, `:3778`, `:3812`, read only at `:3764`. Nothing in semantic
  analysis consults it, so there is nothing for this function to read even if it wanted to;
- it says so explicitly when undecided �?**partly**. It returns `null` for the
  `optimize(array)` case (`:6258`), which Phase 6 added;
- it stops guessing `'memory'` �?**no**. It still falls through to `return 'memory'`
  (`:6259`);
- `'register'` is retired �?**no**. It is still returned at `:6257`, and nothing consumes
  it: all five call sites compare against `'remote'` or `'handle'`. It is a dead return
  value.

So 3b is advanced, not met. Two independent pieces of work, and the second is
independent of 3a:

- **Now, no dependencies:** delete the `'register'` return. Nothing reads it, so this is a
  two-line change plus a check that all five call sites still behave.
- **After 3a:** make it a reader of `chosenArrayStyle` and delete the `arrayParamRep` and
  `requestedArrayImplementation` re-derivation. This is the part that needs the decision
  to exist at semantic time.

**Verify it by** the fact only one of the two derivations can be right: after 3b, a
`remote` array must report the same implementation from `arrayImplementationOf` as from
the generator's `arrayStyleFor`. Today they are two functions that can disagree, and
`refuseIncompatibleArrayAssignment` is where that would show.

**Done in two steps.** `2dc683e` deleted the `'register'` return �?the first bullet
above �?and no call site noticed, as the measurement predicted. `8e54302` did the second
bullet: `arrayImplementationOf` now asks `arrayStyleFor` and maps the style's reason onto
the words its five call sites know, so the two derivations cannot disagree �?the
verification above, landed. Two answers moved as a result of reading the canonical
decision: an alias of a remote array now answers `'remote'` (the function follows the
alias now), and a volatile array reaches `'memory'` through its style instead of by
falling through to the default �?the same answer as before, now stated by the decision
rather than by accident (the branch meant to answer "undecided" under
`#pragma optimize(array)` is dead, §3.5). All five suites stayed green at `8e54302`.
What remains of this item's promise is §1.5.

### 1.3 3c �?the dead reads, and this one is safe to delete

> Delete the dead `'remote'` / `'names'` reads.

Verified, and it is the cleanest item on this list. `arrayParamRep` is written in exactly
ten places �?`mindcSemantic.js:2094`, `:5562`, `:6034`, `:6454`, `:6477`, `:6482`, `:6489`,
`:6496`, and `mindcOptimizer.js:7429` �?and every one of them writes `'handle'`,
`'traditional'`, or `null`. **Nothing writes `'remote'` or `'names'`.** So the six reads
are dead:

`mindcGenerator.js:1540`, `:1541`, `:3752`, `:3753`, `:3837`, `:3838`

Suggested implementation, and the trap in it. The six sites come in **two** shapes, and
conflating them is how this gets half-done.

**Four of them** �?`:3752`–`:3753` and `:3837`–`:3838` �?are the standalone form, and dropping
their dead disjuncts is mechanical:

```js
if (symbol?.arrayParamRep === 'handle' || symbol?.arrayParamRep === 'remote'
    || symbol?.arrayParamRep === 'names') {
```

becomes

```js
if (symbol?.arrayParamRep === 'handle') {
```

**Keep `=== 'handle'`.** It is not dead, and at `:3752`–`:3753` it gates a real decision
inside `arrayStyleFor` �?the mapping onto `{ type: 'embedded', implement: 'divided' }`
with `reason: 'array parameter'` at `:3754`, which is what makes a handle-parameter array
behave as embedded rather than as memory.

**The other two**, `:1540`–`:1541`, are a different shape: the variable is `sym`, not
`symbol`, and the disjuncts sit inside a larger guard, so they cannot collapse the same way.
They are in the parameter-copy loop of `visitFunctionDeclaration` (`mindcGenerator.js:1513`),
whose `// Copy the parameters` step ends at `:1546`, and the condition is the whole `if`:

```js
if (sym.myType?.()?.kind === 'array'
    && (sym.arrayParamRep === 'handle' || sym.arrayParamRep === 'remote'
    || sym.arrayParamRep === 'names')) {
```

becomes

```js
if (sym.myType?.()?.kind === 'array' && sym.arrayParamRep === 'handle') {
```

That one deserves a second look while editing it, because the dead disjuncts sit directly
under the comment that explains the branch, and a careless deletion takes the reasoning
with them. The comment's point: a handle-parameter arrives as ONE packed register, so
copying `_block` / `_pos` �?which `writeSymbol` would do �?leaves them undefined, and the
first access then jumps through a register that is still 0, for an endless loop. Keeping
the comment is the point; the disjuncts were never what it warns about.

**Verify it by** the suite staying green. This is a pure deletion with no behaviour change
available to observe, so the tests are the only evidence there is �?which is also why it
is worth doing now, while the code is fresh, rather than as part of a larger change where
a regression would be hard to attribute.

**Done in `2dc683e`.** All six reads are gone �?both shapes, the `sym` guard collapsed to
`kind === 'array' && arrayParamRep === 'handle'` with the comment above it kept �?the
`'handle'` disjuncts stayed, and the suites were green at that commit.

### 1.4 3d �?drop it; it is answering a different question

> `isRequireMem()` consults the canonical style, so a handled array is not given memory
> of its own. This deletes the dead 4-cell block that every `remote` array currently
> allocates (`set __step 4`, `x_block`/`x_pos`) and never uses.

All three claims in that are wrong, and the item should be struck rather than
implemented.

**A `remote` array allocates no block.** Compiled output for six remote shapes �?`remote
int[4]`, `remote int[3][4]`, `remote Pair p[3]`, `remote Node n[2]` (with a pointer
member), plus the local versions of each for contrast �?contains no `set __step 4` and no
`x_block`/`x_pos` allocation. The *local* `struct Pair p[3]` allocates
`set g:.p_block cell1_id` / `set g:.p_pos 4`; the `remote` one allocates nothing. The
`__step` that does appear in remote output is the **pointer-stride register** used by
`__pointerForward` (`mindcGeneratorBase.js:1022`–`:1031`), emitted when a struct member
needs block-crossing arithmetic. It is not a memory block and it is not dead.

**`isRequireMem()` is not what gives an array memory.** It is `TypeInfo.isRequireMem()`
(`mindcSemantic.js:632`), and its three callers all ask it the same question �?*may a
struct containing this member be held in registers?*:

- `intrinsicallyRequiresMemory()` (`:577`, used at `:585`)
- `isStrictPointerImpl()` (`:588`, used at `:606`) �?and its comment at `:599`–`:604`
  states the reason outright: a struct containing an array cannot live in registers,
  because the array needs memory of its own and a recursive call may need arbitrarily many
- `mindcGenerator.js:1176`, inside `recWork`, which only runs for `isRegStruct()` types

**Its answer is load-bearing.** `check/n2.c` is the test that depends on it: a `near
struct box { int n; int data[3]; }` used recursively. Its generated code contains **four**
block-crossing pointer pairs (`__tempsym_ptr_0` through `__tempsym_ptr_1`, plus the two
`__tempsym_0/__tempsym_1` sets that feed them); the same `near struct` **without** an array
member contains **zero** `__tempsym_ptr_*` pairs. The array member is exactly what forces
the expensive addressing, and `isRequireMem()` is what says so.

Making it consult the canonical array style would therefore not delete an allocation �?
there is none �?and would risk permitting a struct with an array in registers, which is
the thing `:599`–`:604` explicitly rules out.

**What to do instead:** nothing. If the intent behind 3d was to stop remote arrays paying
for storage they do not use, that cost does not exist and the item closes. The
`null_block` / `null_pos` pair that *does* appear in every program is the Phase 5
unbound-handle trap and is deliberate �?it is what makes an unbound handle fail loudly.

### 1.5 The payoff's second half is open: `null` is not one state

§1.1's verification promised that once both sides read the same fact, `null === null`
would become a real "undecided" state. The first half landed at `8e54302` �?the two
functions cannot disagree. What did not land: `null` still answers for several *different*
layouts, and the comparison cannot tell them apart.

Measured, all accepted by the compiler today:

| assignment | the two answers | outcome |
|---|---|---|
| `int a[4]; int b[4]; a = b;` | `'memory'` `'memory'` | admitted �?and then it does not copy (§3.6) |
| `array("encoded")` assigned to `array("encoded")` | `null` `null` | admitted �?a silent no-op (§3.6) |
| `array("embedded")` assigned to `array("encoded")` | `null` `null` | **admitted although the layouts differ** �?the hole proper |
| two plain arrays under `#pragma optimize(array)` �?the case §1.1 predicted | would be `null` `null` | **cannot occur**: the flag that would make them `null` is never set (§3.5) |

So the reachable hole is narrower than written down: it needs two differently-*named*
non-traditional layouts, which is unusual code �?but it is silently accepted today while
the refusal it would hit says "not stored the same way", i.e. the compiler already
considers differing layouts a reason to refuse. The decision this needs is small and
belongs with §3.5 and §3.6, which are the same mismatch seen at run time: either `null`
has to carry the layout it is hiding, or `null === null` has to refuse and the
identically-named pair gets refused beside it until the comparison can see they match.

**Done in `2dbb911`** �?the first option. A request now answers the layout it named:
`traditional` stays `'memory'` (as does `array("embedded_divided")` �?the two reach the
same divided storage, so one word), `array("encoded")` answers `'encoded'`, and
`array("embedded")` answers `'embedded'`. `null` is left to what only the generator can
tell: a `lookup` request, whose category comes from the content table.
`embedded` = `encoded` is now refused -- `Cannot assign an encoded array to an embedded
array: �?not stored the same way` -- pinned by the new
`negative/array_assign_embedded_to_encoded.c`; `embedded` = `embedded` (and `memory` =
`memory`) stays admitted, which is exactly the same-layout set §3.6's copy work
targets. The `encoded` pair is settled there too: an encoded array is a constant table
of contents, so §3.6 refused a whole-array write INTO one rather than copying it.
The two register-vs-memory negative cases that quoted the old `undecided
layout` wording now say `an embedded array`; the negative suite goes 54 to 55.

---

## 2. Phase 7 �?test debt

**Done.** Four items: the width/size matrix was already complete (`check/t13`–`t17`,
`t25`, `t32`, `t39`, `t44`, `t45`, not repeated here); the other three closed at
`1584cf3` and `245c163`, each recorded in its section below.

### 2.1 `MESSAGE:` on 30 negative cases

**30 of the 52 cases then in `testers/unit_tests/negative/` had no `MESSAGE:`**; 22 did.
They pass on "did it fail" alone, so deleting the check that refuses them turns the case
green rather than red. The directory has grown since; §4.3 has the current count.

The two `KNOWN-GAP`s this list started with (`ovl_auto.c`, `ovl_pragma.c`) have since
been removed: the auto-template / overload work made those programs legal, and
`check/t109` / `t110` now pin them as positive cases, so an "accepted today" gap would
assert the same fact twice. `negative/` has no known gaps left. The other 28 are listed
with per-file reasoning in the plan's §9 and in
[`../testers/INFO.md`](../testers/INFO.md); they are not repeated here.

`negative/fn_arity_mismatch.c` is the worked example of why this matters. It was written
for the arity fix, and against the *unfixed* compiler it reported
`FAIL �?refused, but with no message` �?the crash produced an empty error list, which is
precisely the state a `MESSAGE:` assertion exists to catch and precisely the state a
did-it-fail assertion cannot.

Suggested implementation: work from the "say nothing" list the runner already prints.
Add one `MESSAGE:` per distinct reason, not one per error �?a case that quotes every
message it happens to produce stops discriminating the moment an unrelated error appears
alongside.

**Done in `1584cf3`.** All 28 carry `MESSAGE:` lines taken from the compiler's own
wording (regex-escaped, short unique prefixes), and the runner gained `NOT-MESSAGE:` so
a case can also forbid an error. The two `KNOWN-GAP`s that stood then have since been
removed (see above), so `negative/` now states a reason for every case. The rule
applied throughout is the one above — one `MESSAGE:` per distinct refusal reason.

### 2.2 Typedef'd **data** pointer, the second half

`check/t40_typedef_data_pointer.c` covers the first half, done in Phase 1. What is still
wanted is a typedef'd data
pointer �?not a function pointer �?used in a way that reaches the alias builder. Worth
re-checking rather than writing fresh, because Phases 5 and 6 added handle typedefs and
the shape may now be covered by accident.

**Re-checked, then done in `245c163` as `check/t160`.** The re-check found no accidental
coverage: no test from Phases 5 or 6 contains a `typedef` at all �?the only typedef'd data
pointers in the tree were t40 and t41, both first-half. t160 walks the alias builder's
remaining paths: an alias of an alias (the copy path, no pointer wrap), the typedef'd
pointer as a PARAMETER written through, an element of a local array, and a pointer whose
target is itself a typedef'd array. The global-array shape (`&arr[i]` on a global) is
deliberately absent: probing it exposed a pre-existing defect instead, recorded as §3.4,
and the file's header says so.

### 2.3 A dedicated remote-`&x` regression

`check/t118_addr_of_remote.c` partly covers it. The dedicated test should assert that
remote and non-remote `&x` produce **different** code �?Phase 4's actual finding was that
`remote int x[4]` and `int x[4]` generated byte-identical code, so the discriminating
assertion is the difference itself, not either side of it.

**Done in `245c163` as `check/t161`.** The difference itself, from both directions:
`widthof` constant-folds into the emitted `print`, so the two `EMIT` lines *are* the
widths �?1 for the remote address, 2 for a memory pair, where Phase 4's bug made both
`print 2` �?and three `EMIT-NOT` lines forbid either address taking the other's form.
t118 keeps asserting each side's positive form; t161 states the difference with its own
names, so the guard survives t118 being trimmed and nothing is asserted twice.

### 2.4 Out-of-bounds subscripting — decided in §7.4

```c
int r[3];
int s[] = r;
s[5] = 7;      // silently succeeds, and prints 7
```

This is C-like permissiveness versus trapping, and it is **not** a blind fix: a bound
check changes codegen for every subscript in the language, and it changes what existing
correct programs do. It needs a decision and a scope, not a patch. Whoever takes it should
start by finding out how many of the 532 driven cases would notice �?that number is the
real cost.

**Decided and done in §7.4** (`8d8fb43`). A constant index is refused only where the
length is a compile-time fact; the measurement this paragraph asks for came back empty
(no driven case contained a constant out-of-range index), and the dynamic `s[i]` and
the length-less pointer/handle stay unchecked, left to run time.

### 2.5 The zero-candidate overload refusal has no case

`94f5737` made a shared name whose argument count matches no version say exactly one
thing �?`No version of 'add' accepts these arguments (int, int, int, int)` �?and
`f391690` closed the read past the end of the parameter list that suppressing the count
check had opened (`mindcSemantic.js:6742`, guarding the `:6743` read). Nothing in the
tree locks either one: no case matches `No version of`, and
`negative/fn_arity_mismatch.c` only asserts the *single-function* count message.

One negative case covers both �?two `add` versions (2 and 3 parameters) called with four
arguments. On the compiler at `53ce864` that input threw a `TypeError` before any
diagnostic existed, which `negative.mjs` reports as `refused, but with no message`, so the
case is red on the old code and green now.

It does not cover the other half. Deleting the `shared` guard (`mindcSemantic.js:6717`)
puts the count message back *next to* `No version of …`, and a case that carries only
`MESSAGE:` lines still passes �?every `MESSAGE:` still matches, because matching is
"some error", not "every error". Saying what must **not** be reported needs an annotation
the runner does not have: **`NOT-MESSAGE: <regex>`**, one per line, failing the case if
any error matches. That is a small runner change, and it is the only shape that can
assert silence.

**Done in `1584cf3`.** `negative/ovl_shared_noversion.c` is the case written above (two
`add` versions, four arguments: red on the old compiler as `refused, but with no message`,
green since), and the runner change exists �?`negative.mjs` reads `NOT-MESSAGE:` lines
and fails the case if any error matches them. The count message coming back alongside
`No version of …` is now asserted against, not just suspected.

---

## 3. Defects found while auditing, in no plan

The first two were surfaced by probing the arity fix and neither is reachable from an
overload. The last four were surfaced while closing §1 and §2. All are pre-existing �?
§3.3–�?.6 were each re-measured against `2dc683e`, before this work's phases �?and none
is attributable to a phase.

### 3.1 Single-quoted character literals lose their text

The lexer **does** classify `'x'` as a `char` �?`int c = 'x';` is refused with
`Cannot initialize 'int' with 'char'`, so the classification is right. What is missing is
the text: `visitCharacterLiteral` (`mindcGenerator.js:4867`) reads `node.raw.replace(...)`,
and `node.raw` is `undefined` for the single-quoted form. One missing field, two different
failures depending on where the value lands:

| program | outcome |
|---|---|
| `char c = 'x';` | **runtime trap** �?`Cannot read properties of undefined (reading 'string')` at `set g:.f:main.b:1.c` |
| `void p(char c) {…} p('x');` | **generator crash** �?`Cannot read properties of undefined (reading 'replace')` at `mindcGenerator.js:4868` |
| `char c = "a";` | works |
| `p("a")` | works �?this is what `check/t117_auto_scalar_overload.c` does |

Suggested implementation: the double-quoted form works and goes through
`visitStringLiteral`, so the fix is most likely one line in the lexer �?carry the literal
text onto the node the same way the string form does �?rather than anything in the
generator. Fix the lexer and both failures go at once.

**This is the only place in the test suite that exercises a `char` parameter**
(`t117_auto_scalar_overload.c`), and it uses the double-quoted form, which is why the gap
survived.

**Resolved with §7.1 in `0784da0`.** The lexer now carries the literal text
(`readCharacter` passes a `raw`, the way `readString` already did), and the
optimizer's `cloneAST` copies both `value` and `raw` for a `CharacterLiteral` �?the
missing case that silently dropped them and turned a cloned literal into the crash
at `visitCharacterLiteral`. Both failures are gone: `p('x')` into a `char` parameter
is now a clean one-line `int`→`char` argument refusal, and `char c = 'x';` refuses
the same way (`negative/char_literal_is_int_refused.c`).

### 3.2 `for (int i = 0; �?` is not parseable

The for-init takes an expression, not a declaration:

```
Unexpected token in expression: INT 'int' | Expected SEMICOLON, but found IDENTIFIER 'i' | �?
```

and it ends in a parser crash: `wrapToCompound` (`mindcParser.js:1457`) throws at `:1458`
on a `null` target, reached from `parseForStatement` (defined at `:1509`, which calls it
at `:1529`). `int i; for (i = 0; i < 2; i++)` works, and so does `while`.

Worth deciding deliberately: either the dialect does not support C99-style declarations
in for-init, in which case the parser should say so in one line instead of four plus a
crash, or it should support them. What it should not do is both.

**Resolved with §7.2 in `189f546`.** The init now parses non-destructively
(`parseForInit` tries a declaration first and restores the token stream otherwise),
and the loop is wrapped so the declaration lives in the loop's OWN scope:

    { int i = 0; for (; test; update) body }

�?the inner `for` keeps the shape every pass already knows, and the wrapper block
gives `i` the same scope a nested block would: gone after the loop (undeclared-
identifier refusal), and an enclosing `i` is shadowed. The empty-init `;` is now
consumed in place (it never was, so `for (; test; update)` misread its test as the
update); every clause may be empty and `for (;;)` runs until a break. Fixing it
surfaced a PRE-EXISTING optimizer bug �?a `for` over a variable that shadows an
outer one hung in an infinite loop, because the per-scope constant-propagation
pass folded a shadowed loop variable to the outer value and deleted its own `i++`;
both writes are fixed in `189f546` (see §7.2). Cases: `check/t163_for_clauses.c`
and `negative/for_loop_init_scoped_refused.c`.

### 3.3 Both `stackcheck` overflow paths trap instead of reporting

`stack/so1.c` �?the default behaviour, write a fixed message to `__error` and stop �?runs
clean and is among runall's passing cases. The two pragma variants do not: they carry
`KNOWN-GAP` annotations in the cases themselves, and this is the record those annotations
point at (`Defect: docs/OPEN_WORK.md 3.3`).

| case | pragma | what happens |
|---|---|---|
| `stack/so2.c` | `stackcheck(onOverflow)` | the handler returns with `__stackframe_block` left at -1; the next frame allocation does `getlink` on it, gets null, and the walker reads through it �?`TRAP: Cannot read properties of null (reading 'cells') (at instruction 34: read __block __curptrblock 2)` |
| `stack/so3.c` | `stackcheck()` | no capacity guard is emitted at all, so on exhaustion the walker follows `next block = -1` off the chain and reads through a null link �?the same trap |

Same trap, two different omissions: the overflow handler does not restore the frame, and
the no-argument form does not check. The decision to make before fixing is what
`stackcheck()` with no arguments *promises* �?"no check, running out is the contract"
(and then the crash should still be a clean report, like so1's) or "fall back to the
default guard". so1's path is the working precedent either way.

**Done in `9cbaf8c`.** The decision was "running out is the contract". The no-argument
form still does not WATCH for overflow -- no `__error` message is written and no handler
is called -- but the walker's chain-end check is unconditional now, and for
`stackcheck()` it lands in a bare `end`: running out stops the walker cleanly instead
of following `next block = -1` off the chain and reading through a null link. The
handler form no longer resumes the walker through the caller's continuation with
`__stackframe_block` left at -1 either: the handler now returns straight into `end`, so
it reports and the walker stops -- the half-allocated frame has nowhere safe to continue,
which is why abandoning it is the only honest outcome. so2 prints `999` and stops, so3
stops silently, both without a trap; so1 is untouched and so is every non-overflowing
program, since the chain-end check only fires when the next block is unusable. Runall
goes 265/277 to 267/277 (12 -> 10 known gaps) and the KNOWN-GAP annotations come out of
the two cases.

### 3.4 The address of a global array element or struct field

```c
int arr[4] = {2, 3, 4, 5};
void main() { int *t = &arr[2]; print(*t); �?}
```

The bug had two parts:

- a global access-through-pointer container (array/struct/union) never had its
  LIVE address pair `X_block`/`X_pos` written at boot: only the
  `X.__pointer` slot was. Everything that walked or used the live pair
  (`&arr[i]` generation reading that pair, etc.) fell back to uninitialised
  registers. Locals get the pair from frame machinery/init temp. (Done)
- a global struct/union initialized with a braced list was assembled by
  walking from its pair via `__pointerForward` at boot -- BEFORE the
  function machinery (and thus __pointerForward's register prologue) ran.
  The call jumped back to the program start (step limit). For global
  access-through-pointer structs/unions at boot, the member values from a
  registry-struct temp are now written straight into the data cells at
  `X.__pointer` (the same way the array initializer writes into assigned
  space). The union case stores only the members the list assigns. (Done)

Measured results:

| program | outcome |
|---|---|
| `int *t = &arr[2]; print(*t);` �?global array | works |
| `&arr[0]` �?the same | works |
| `&arr[2]` passed into a function and dereferenced there | works |
| `int *t = &s.y;` �?global struct field (with init) | works |
| `struct P s = {4,5}; print(s.y); print(*&s.x);` �?both read and address | works |
| `union U u = {7}; int *t = &u.x; print(*t);` | works |
| `&g` �?global scalar | works |
| `print(arr[2])` �?direct subscript, no address taken | works |
| `&a[2]` �?element of a *local* array | works |
| typedef'd or plain pointer | identical either way |

`check/t160` was amended to drop its "global-array shape �?deliberately absent" caveat, and `check/t166` now pins global element/field address-of.
The fix keeps `#pragma` invariants and all existing suites green; `&s.b` (the recorded hang) and array element address-of now work.
### 3.5 `compiler.arrayOptimize` is read twice and set nowhere

Two reads decide what an auto-chosen array layout answers:

- `arrayImplementationOf` (`mindcSemantic.js`, the `arrayOptimize` line): `return null` �?
  the "genuinely undecided" path §1.2 credited Phase 6 with adding;
- `autoRepresentationOf` (`mindcSemantic.js:5747`): the comment above it says *"the choice
  is not visible here �?so refuse instead"*, then `return 'ambiguous'` �?the refusal.

Neither can fire. `#pragma optimize(array)` writes `optimizerConfig.doArrayOptimize`
(`mindc.js:394`) and optionally `optimizerConfig.arrayOptimize = JSON.parse(...)`, an
*object*, at `:396`; every other reader picks the config up as
`extraConfig.getAttribute('optimizeOption')` �?`mindcGenerator.js:363`,
`mindcOptimizer.js:368`, `mindcSemantic.js:5084`. A repo-wide search finds no assignment
to a property `compiler.arrayOptimize` at all, and `=== true` could not match the object
form anyway.

Measured consequence: under `#pragma optimize(array)` a plain array still answers
`'memory'` from `arrayImplementationOf` �?`int a[4]; int c[4] = array("encoded", �?; a = c`
is refused with *"an array in memory"* for the plain side, at `245c163` **and** at
`2dc683e`. And in `autoRepresentationOf` the `'ambiguous'` refusal never happens: auto
versions always take the `'memory'` guess the comment directly above it says to avoid.

The fix is a decision, not a deletion: what *should* `optimize(array)` answer here �?
`null` (undecided, refuse in both directions) or `'memory'` (what happens today, by
accident)? The optimizer's own behaviour under the pragma is untouched; only these two
reads are dead. The answer was to keep today's behaviour; `c9dd030` deleted them (below).

**Done in `c9dd030`.** The decision made itself: keep today's answer. Under
`#pragma optimize(array)` a plain array answers `'memory'`, exactly as it always
actually has �?the `null`/`'ambiguous'` branches were gated on
`compiler.arrayOptimize`, and no assignment to that property exists anywhere, so
they could not fire. Wiring the flag would be the one thing the invariants
forbid: a pragma that changes an array's representation answer changes program
output. So the two dead reads are deleted (both `mindcSemantic.js`), their
defaults (`'memory'` in `arrayImplementationOf` and in `autoRepresentationOf`)
are now stated in the comments, and nothing a suite can measure moved �?all five
stayed green.

### 3.6 Same-layout array assignment is accepted and does not copy

`refuseIncompatibleArrayAssignment` (`mindcSemantic.js:4253`) refuses arrays whose layouts
differ and admits the rest �?and the refusal's own wording ("not stored the same way")
says matching layouts are the precondition for the exchange. Measured, the admitted cases
then do not exchange anything:

| program | outcome |
|---|---|
| `a = b`, two plain globals `{1,2,3,4}` / `{5,6,7,8}`, `print(a[0])` after | accepted, `a[0]` reads **0** �?neither its old 1 nor b's 5 |
| the same, both local | accepted, `a[0]` reads **0** |
| `c = d`, both `array("encoded")`, `print(c[0])` after | accepted, `c[0]` unchanged �?a silent no-op |
| `array("embedded")` assigned to `array("encoded")` | accepted (that is §1.5's hole), also a no-op |
| `for (i = 0; i < 4; i++) a[i] = b[i];` �?the manual version | copies correctly: `5` |
| `x = y` inside a function on two array parameters | the one form that changes the left side: `5` |

All of it reproduced at `2dc683e`, so no phase caused it �?and nothing in the 521 driven
cases pins what the assignment is *meant* to do (all five suites are green through
`245c163`). The semantics need deciding before any fix: copy element-wise, which is what
the parameter form suggests, or refuse outright, which is what C does (arrays are not
assignable). Distinct from §5's `s = b;` no-op, which is a handle *parameter* and was
decided there.

**Done in `e74df68`.** The copy. `visitAssignmentExpression` used to send array pairs
down the generic lvalue write, which held the array "by reference" and wrote nothing;
the element loop `veccpy` already had is now shared (`emitElementCopy`), and `a = b;`
runs it with the smaller of the two lengths as the bound, so the sides only need the
same layout, not the same length. `check/t164` pins the memory copy, `check/t165` the
register (embedded_divided) copy, with the veccpy-shaped EMITs; the parameter form
(`x = y` on two array parameters) that already copied keeps copying, through the same
loop.

One row of the table above did not survive as a COPY. `c = d` on two encoded arrays was
"accepted" only because the reference-write copied nothing; the copy makes the no-op
impossible to hide, and the layout settles the question: an encoded array is a constant
table of contents -- `EncodedSlotRet.set` refuses writes, so there are no cells for the
copied elements to land in. `refuseIncompatibleArrayAssignment` now refuses a non-const
encoded DESTINATION with a message that names the layout
(`negative/array_assign_into_encoded.c`); a target that is genuinely `const` keeps the
plain "Cannot assign to const variable" refusal it already had. That is why §1.5's note
above narrows "stays admitted" to `embedded` = `embedded` and `memory` = `memory`.

### 3.7 Assigning an open-dimension array parameter

`int s[]` is an open-dimension array parameter. It arrives as a packed handle
**by value** — a copy of the caller's handle, with the length inside the packed
value. So `s = b;` has neither a stored length to copy against nor a cell of
its own to rebind:

| program | outcome |
|---|---|
| `void rebind(int s[]) { s = other; }` called with a memory array, default | the caller's array is overwritten (`1 2 3`) |
| the same with `#pragma noinline` | the caller's array is untouched (`5 6 7`) |
| `void f(int a[], int b[]) { a = b; }` | the same split |
| a SIZED parameter `void g(int s[3]) { s = other; }` | copies `1 2 3` in both modes |

The first two rows are the same program; only the pragma differs. §3.6 made
`a = b;` an element copy, and that is what exposed it: at `e74df68^` both modes
printed `5 6 7`, because the assignment copied nothing anywhere. With the copy
in, inlining replaces `s` with the caller's array and the line becomes a real
copy, while the out-of-line parameter still has a static destination length of
0 (`emitElementCopy` takes `min(destinationLength, sourceLength)`, and a
handle's length is a run-time fact). The two modes then disagree — a pragma
changing program output.

`negative/vecalias_into_parameter.c` had already refused the intrinsic form
(`vecalias(&s, b)`) for the same reason. The decision is §7.5.

### 3.8 A sized array parameter that receives a bound handle traps

`void f(int s[4])` is a SIZED parameter, so it trusts the call-site note to pick
its representation. A bound unbound handle (`int h[]; h = e;`) holds a packed handle
in its ONE cell, but `arrayArgumentNotes` classified it by
`requestedArrayImplementation` alone -- null for `h` -- so the note said
"traditional", and the callee was built as a two-word pointer from a one-word value.
Reading it walked through garbage:

| program | outcome |
|---|---|
| `f(int s[4])` called with `h` (bound to an embedded array) | trapped: `memory index 0 out of range` |
| the same, writing `s[1]` | trapped the same way |
| `f(int s[])` called with the same `h` | worked (`1 4`) |
| `f(int s[4])` called with the embedded array directly | worked (`1`) |
| `f(int s[4])` called with a memory array | worked (`1`) |

The open-dimension parameter never had the bug because `hasOpenDimension` forces it
to a handle before the notes are read. The fix makes the note follow the argument: a
symbol that is `isUnboundHandle` says "handle", whatever it was bound to. The decision
is §7.6.

### 3.9 Element writes through an array alias

`int al[] = mem;` is an alias: the declaration makes `al` the same array as
`mem`, not a copy. Reads went through the target, but writes were wrong in
three ways:

| program | outcome |
|---|---|
| `int mem[4] = {1,2,3,4}; int al[] = mem; al[0] = 9;` | crashed: `Internal parser error: an encoded array is constant and cannot be written to` |
| the same on an `array("embedded_divided", ...)` target | `al[0]` read 9 but `mem[0]` stayed 1 |
| `int a[] = mem; int b[] = a; b[0] = 9;` | the root was never reached |
| `int mem[4];` (no initializer) + the same write | worked |

Two independent causes:

- the optimizer's constant bookkeeping looked at the ALIAS symbol, which has
  no constant contents, never at the target. A small constant target was
  promoted to an encoded table (`finalizeConstantArrays`), so the real write
  had no cells; or the target's known elements were kept and `mem[0]` folded
  back to its initial value (`applyArrayWrite`).
- an explicit `array("encoded", ...)` target has no cells at all, and the
  write reached the generator, which threw an `InfrastructureNotImplemented`
  that surfaces as `Internal parser error`.

The decision is §7.7.

### 3.10 `break` / `continue` outside a loop

`break` and `continue` were parsed but never checked. Outside any loop they
emitted an unresolved `jump {loop_break}` / `jump {loop_continue}`, and the
program then ran away:

| program | outcome |
|---|---|
| `void main(){ break; }` | compiled; `jump {loop_break}` never resolved; step limit |
| `void main(){ continue; }` | the same |
| `void main(){ if (1 == 1) break; }` | the same (the block is not the context) |

The decision is §7.8.

### 3.11 `do ... while` was not parseable

The lexer had the `do` token and `DoWhileStatement` existed as a node type,
but the parser had no `DO` branch, so a do-while failed with
`Unexpected token in expression: DO 'do'`. The semantic analyzer and the
generator had no visitor either.

The decision is §7.9.

### 3.12 `switch ... case` was not parseable

The lexer had `switch` / `case` / `default` tokens (with a `/* Unsupported */`
note on `switch`), but the parser had no branch for them. A switch failed at
the parser, and the semantic analyzer and generator had no node for it.

The decision is §7.10.

---

## 4. Harness debt

### 4.1 Six tools imported `sim.mjs` from the wrong directory �?fixed in `2dc683e`

`ex6run.mjs`, `hdrsim.mjs`, `ms2run.mjs`, `ms3run.mjs`, `ms4run.mjs` and `pdtest.mjs` all
`import �?from '../sim.mjs'`, but they live in `testers/tools/` next to `sim.mjs`. Fixed
to `'./sim.mjs'` in `2dc683e` �?it was the cheapest thing on this list. Left alone: the
same-shaped files under `testers/unit_tests/tools/`, which import `'../sim.mjs'` where no
`sim.mjs` exists; they are not entry points of any runner and nothing imports them, so
there is nothing to fix for.

### 4.2 `runall.mjs` omitted `stack/` �?fixed in `2dc683e`, the gap was §3.3

`runall.mjs:3` walked `['suite', 'mem', 'arr', 'arr2', 'ptr2']` �?101 cases �?while the
three cases in `testers/unit_tests/stack/` (`so1.c`, `so2.c`, `so3.c`, the last two using
`#pragma stackcheck`) were in no runner at all. Fixed in `2dc683e`: the directory list
carries 14 directories and 275 cases, and `KNOWN-GAP:` lines report known-broken cases on
their own line instead of failing the run (8 today). So `#pragma stackcheck` is driven
in all three forms: `so1.c` passes as it always did, and §3.3 fixed both overflow paths,
so `so2.c` and `so3.c` pass too.

### 4.3 "176 cases have no runner" �?stale; re-measured, all 542 are driven

The original measurement (518 `.c` files, 342 driven, **176** in nine directories no
runner read) predates `2dc683e`. Re-measured at `245c163`: 521 `.c` files; the §3 and §7 cases
bring the count to 542 under `testers/unit_tests`, every one of
them driven �?

| runner | cases | covers |
|---|---|---|
| `check.mjs` | 186 + 10 peers | `check/`, plus the 10 `check/peers/*.c` it drives on their owners' behalf |
| `negative.mjs` | 64 | `negative/` |
| `nomem.mjs` | 7 | `nomem/` |
| `runall.mjs` | 275 across 14 directories | the five original dirs plus `t/`, `hdr/`, `big/`, `u/`, `uc/`, `tests/`, `stack/`, `cases/`, `exttests/` |

186 + 10 + 64 + 7 + 275 = 542. The caveat that replaces "no runner" is weaker but real:
most of those directories are driven *by runall*, whose bar is "it ran" �?only six files
in these directories carry an `EXPECT:` line; `suite/04_struct`, `mem/d1`,
`ptr2/p1` and `tests/compound` are the four added most recently. Assertion density per directory is
`testers/INFO.md`'s subject, not this file's.

### 4.4 Extension loading: roots fixed in `2dc683e`, the warning note was stale

The original claim was that `runsim.mjs` pointed `EXT_ROOT` at `testers/tools/src/ext/`,
which does not exist, so `collectExtensions` found nothing, `#include "*.js"` was
silently skipped, and a case relying on an extension would pass by accident. Fixed in
`2dc683e`: `EXT_ROOT` and `INCLUDE_ROOT` now point at the repository's top-level
`include/`, which exists and carries `.h` and `.js` files, and all four `exttests/` cases
pass through the include→extension path �?the silent-skip scenario no longer holds for
them.

**The note was stale.** It dates from the initial upload (`d98dd2b "Upload New File"`),
before the merge existed. The constructor's `extensions` parameter is used
(`embeddedExtensions`), and `compile()` merges it with the `#include "*.js"` modules the
lexer imports (`mindcLexer.js:1131`, `mindc.js:350-368`) into the parser's
type/function/handler tables. The four `exttests/` are the proof: `ex1`/`ex2` include
`archon.js`, `ex3`/`ex4` include `sharelist.js`, and all four pass in `runall`. The comment
now says what the parameter does; nothing is deferred.

---

## 5. Deliberate non-decisions �?do not "fix" these

Each was a decision, taken with the reason recorded. Re-litigating them without new
information is how they get broken.

- A handle **cannot cross processors**. The packed get/set helpers are line numbers in
  the program that built them, so a remote→local handle copy (`b = a`) yields a local
  handle whose helpers are wrong. Stays refused.
- `veccpy` is element-wise into owned storage; a handle **destination** is refused.
  `vecalias` into a handle **parameter** is refused too.
- `vecalias(&a, b)` **keeps** the `&`. A handle is one register, so the address of a
  handle is an ordinary one-word pointer �?the cheapest signature available, and a
  one-store body.
- `&` on a handle is **not** refused.
- `remote` / register / embedded arrays are handles unless inlined.

## 6. Known pre-existing behaviour, not attributable to any phase

Every item here is now fixed or closed; each points at the record and the case that pins it.

- ~~`int al[] = mem;` alias followed by an inlined write — *"an encoded array is
  constant and cannot be written to"*.~~ → fixed in `e13d454`; §3.9/§7.7, `check/t169`.
- ~~A handle parameter that is sized (`int s[4]`) traps; so does an unbound handle sized
  the same way.~~ → fixed in `f970d51`; §3.8/§7.6, `check/t168`.
- `m = remote(@this, r)` produced an **empty error list** and a
  `fatalError: Cannot read properties of undefined (reading 'type')`. The empty list was
  the dangerous half: it makes a crash indistinguishable from a clean refusal to
  anything reading `errors` alone. (§7.3 closes it; the record was already
  stale �?the walk guard was added the same day `94f5737`, before the record.)

---

## 7. Decisions on the defects in §3 and §6

Recorded so these are not re-opened, in the order they were given. **§1, §2 and §3 are
closed**: their defects have decisions either in their own §3 record or below; §7.10 is the last one added.

### 7.1 `'x'` is an `int` holding its ASCII value

A single-quoted literal has type `int` and evaluates to the character's ASCII code, so
`int c = 'x';` compiles and printing `c` prints `120`.

This is more than §3.1's "carry the text onto the node". The lexer classifies `'x'` as
`char` today, which is why `int c = 'x';` is refused with `Cannot initialize 'int' with
'char'` �?so there are two halves, and they land together:

- the expression's type becomes `int`. This is the half that changes behaviour: the
  refusal above disappears, and a literal used as a value is a number;
- the node carries the literal text, which is what `visitCharacterLiteral`
  (`mindcGenerator.js:4867`) reads. §3.1's generator crash and its runtime trap both go
  with it.

`char c = 'x';` then becomes an `int`→`char` initialization. Whatever the compiler already
does for `int`→`char` is the answer; if that is a refusal, it has to be a clear one-line
message and not a crash. Settle it by testing both when this is implemented.

**Done in `0784da0`.** Both halves landed together. The expression's type is `int`
(semantic `visitCharacterLiteral` + `getExpressionType`'s case), so `int c = 'x';`
compiles and prints 120, `'x' - 'a' + 1` is 24, and escapes decode to their codes.
What codegen emits is the ASCII number (`visitCharacterLiteral` no longer echoes the
raw text). The node also carries its text �?`readCharacter` now gives the token a
`raw`, the way `readString` always did �?and the optimizer's `cloneAST` gained the
`CharacterLiteral` case (value + raw), which is the half that made `p('x')` reach
codegen textless and crash: the `raw` was dropped by the clone, not by the lexer.
`char c = 'x';` is the clean one-line `Cannot initialize 'char' with 'int'` refusal
from the already-existing int→char rule, not the 3.1 crash or trap. Cases:
`check/t162_char_literal_is_int.c` (int value, escapes, overload picks `int` for `'x'`
and `char` for `"a"`) and `negative/char_literal_is_int_refused.c`.

### 7.2 `for (int i = 0; �?` parses, and every clause may be empty

Support a declaration in the for-init, and check the forms that leave a clause out:

```c
for (int i = 0; i < 2; i++) �?  // declaration in init: four errors and a crash today
for (; i < 5; i++) �?             // empty init
for (;; i++) �?                   // empty init and empty condition
for (;;) �?                       // all three empty
```

The crash is not the parse: `wrapToCompound` (`mindcParser.js:1457`) throws on a `null`
target at `:1458`, reached from `parseForStatement` (`:1509`, calling at `:1529`). So the
work is (a) parse a declaration where the init expression is expected, in the loop's own
scope, and (b) make an absent clause reach `wrapToCompound` as something it can handle.
Each empty form needs a case proving it *runs*, because "parses" and "runs" are separate
claims here: `int i; for (i = 0; �?` and `while` already work, so the generator has an
existing shape to copy.

**Done in `189f546`.** All four forms parse, run and terminate, and each empty form
has a case proving it runs (`check/t163_for_clauses.c`):

- the declaration-init is wrapped as `{ int i = 0; for (; test; update) body }`, so
  `i` is in scope for test / update / body and gone after the loop �?an enclosing
  `i` is shadowed exactly like a nested block (`0 1 2 99` is part of the case);
- the empty-init `;` is consumed in place �?it never was, so `for (; test; update)`
  mis-parsed its test as the update clause;
- `for (;;)` runs until a break, and the multi-declarator init
  (`for (int a = 1, b = 3; �?`) parses too.

Two optimizer fixes ride along, and both fix a PRE-EXISTING defect that §7.2 turns
into a user-reachable hang: a `for` over a variable that shadows an outer one used
to run forever. `traverseAndReplaceConstants` (`mindcOptimizer.js`, per-scope pass)
saw the loop's `i++` with the scope of the scope it started in, and folded a
shadowed read to the OUTER variable's value; the walk now honours scope boundaries
(each child scope is walked by its own pass), and the identifier fold requires the
symbol ITSELF to be a constant (`symbol.isConstant`), not a same-named outer one.

`negative/for_loop_init_scoped_refused.c` pins the scope: using `i` after the loop
is `Undeclared identifier 'i'`.

### 7.3 `m = remote(@this, r)`

Fix it, in two steps, because the failure has two halves.

1. **The empty error list goes first.** The compiler crashes with
   `fatalError: Cannot read properties of undefined (reading 'type')` after producing no
   message at all �?and an empty `errors` array is indistinguishable from a clean refusal
   to anything that reads only that (§2.1's argument for `MESSAGE:` is the same weakness,
   on the path `fn_arity_mismatch.c` covers). Whatever this call turns out to be, it must
   not be able to reach the crash without saying something.
2. **Then decide what it should be.** Accepting it means `m` takes over `r`'s
   representation; refusing it means joining the handle/array conversions that are
   deliberately refused (§5). Start from the read that produced the `undefined` �?the name
   it was looking for is the fact that is missing, and that says which of the two the
   language already intends.

**Done in `be3aeb8`.** Both halves are closed, and the record of the first was
wrong in a way that matters: the crash was gone before §7 even started.

1. `94f5737` (the same-day arity fix §2.5 covers) added the walk guard that had
   been missing, so by the time §6 recorded the crash it had already become a
   message �?"Function 'remote' expects 0 arguments, but 2 were provided" �?and
   `f391690` guarded the type walk too. The empty list was gone. What §6 still
   got right is the weakness: *nothing here can be allowed to die without saying
   something*. What it got wrong is the cause �?`remote` takes no declared
   parameters at all, so "expects 0 arguments" states nothing about the call.
2. The read that used to produce the `undefined` looked for
   `expectedParams[0].type`, the parameter list of an ordinary call �?and that
   list does not exist, because `remote` is a BINDING FORM: it names another
   processor's variable, only meaningful as the initializer of a `remote`-
   qualified declaration (which `consumeRemoteDirective` detaches before the
   expression walk). Used as a value it is refused in `visitFunctionCall`
   (`mindcSemantic.js`), at the CALL rather than by the assignment's conversion
   check: the conversion check cannot see the `void*` case and an array or a
   struct-pointer target behaves the same way �?typing it `void*` let all three
   reach the generator as `{not_implemented}` when probed.

`negative/remote_as_value_refused.c` pins the refusal for the two shapes the
record named (`int m` and the looser `void *m`), and its `NOT-MESSAGE:` line
asserts the bogus arity message is gone. That is the first real use of
`NOT-MESSAGE:`, which surfaced a latent bug in the shared annotation reader:
`\bMESSAGE:` matches the `MESSAGE` inside `NOT-MESSAGE:` (the `-` is a word
boundary), so a case that must stay silent about a pattern could not say so.
`annotationsOf` (`testers/tools/annotations.mjs`) now requires the marker not
to follow a word character or `-`.

### 7.4 Out-of-bounds subscript — the static check, where the length is known

**Decided and done in `8d8fb43`.** Of the four options the record weighed, the one
taken is the one the compiler can answer for free: a constant subscript against an
array whose length is a compile-time number is refused while it is still a source-level
fact.

- `int r[3]` refuses `r[3]`; `int m[2][3]` refuses `m[5]` (the index binds to the
  outermost dimension, 2) and `m[1][5]` (the inner one, 3). A typedef, or an
  initializer-bound `int s[] = r;`, carries the length and is checked the same way.
- A dynamic subscript (`s[i]`) is not looked at: nothing at compile time knows `i`. Nor
  is a `pointer`, nor an array whose length is not known — an unbound handle, or a
  parameter, where the length does not exist yet; the existing unbound-handle rules
  already refuse a read that provably precedes its binding.
- No generated code changes. The check is purely semantic, so every program that
  compiled before still compiles and still emits the same instructions. One consequence
  worth stating: a constant subscript is refused wherever it appears, so the
  one-past-the-end address `&arr[len]` is refused too. Nothing in the tree uses that
  idiom; it can be relaxed if it is ever wanted.

**The two measurements the record asked for**, taken before the check was written:

- `int s[] = r;` DOES leave `r`'s length on `s`: the symbol's array type carries it, so
  a constant subscript on `s` is checked. A bare `int s[];` bound later (`s = r;` or
  `vecalias(&s, r)`) keeps an unknown length and is left unchecked.
- No driven case contained a constant out-of-range index. With the check in, `check`
  stays 179/0, `nomem` 7/0, `loadorder` 12/0/2 and `runall` 267/277; `negative/` gains
  the one case (56 → 57).

`negative/array_subscript_out_of_bounds.c` pins it, asking for both refusals by name:
`r[3]` on length 3 and `m[5]` on length 2.

### 7.5 Assignment to an array parameter

**Done in `613cafa`.** Refuse it, for the open-dimension shape only.

`int s[]` arrives as a by-value handle: assigning it can only rebind the
callee's copy, and that copy has no static length for the element loop to
stop at. Both facts say the same thing — the caller's array cannot change —
so `s = b;` is refused at semantic time, in
`refuseIncompatibleArrayAssignment`, with the same advice
`vecalias_into_parameter.c` gives: write the elements (`s[i] = ...`) or bind
a handle you own.

A SIZED parameter (`int s[4]`) is left alone: its outer length is a
compile-time fact, so §3.6's element copy has a bound and reaches the caller's
storage in every compile mode (measured `1 2 3` with and without
`#pragma noinline`). Refusing it too would be a larger semantic change than
this defect needs.

Cases: `negative/array_parameter_assignment_refused.c` (both spellings) and
`check/t167_handle_param_element_write.c` (the supported element-write path,
re-run under all five invariance pragmas). Nothing else in the driven corpus
assigned to an open-dimension parameter, so no expected output moved.

### 7.6 A sized parameter receiving a handle

**Done in `f970d51`.** Trust the argument, not the declaration.

A sized array parameter cannot force a handle the way an open one does: its declared
length is a compile-time fact, so it takes the shape the call site hands it. A bound
unbound handle is one register holding a packed handle (get / set / length / size), so
`arrayArgumentNotes` now records "handle" for an `isUnboundHandle` argument. The
parameter arrives as a handle, and reads, `lenof` and element writes all go through
the packed helpers.

A function called with BOTH a memory array and a handle keeps the existing refusal --
`Parameter 's' is passed both an array held in registers and an ordinary in-memory
array; they have no layout in common` -- which is the honest answer: one parameter
cannot be two shapes.

Cases: `check/t168_sized_param_receives_handle.c` binds the handle to an embedded
array and to a memory one, reads both, writes through the handle, and checks the
caller sees the write, under all five invariance pragmas.

### 7.7 Writes through an array alias

**Done in `e13d454`.** Follow the alias; refuse only what has no cells.

`applyArrayWrite` now follows the `arrayAliasOf` chain to the target before
touching the constant table, and marks the target `arrayHasRuntimeWrite` even
when the value or index is unknown. That keeps a constant-initialized target
in memory (instead of promoting it to an encoded table) and stops its known
elements from folding back after a write through the alias.

An explicit `array("encoded", ...)` target is different: it has no cells, so
no alias can write it. That is refused in `visitAssignmentExpression`, by a
new `arrayAliasOfElement` helper that resolves the chain, with a message that
names both the alias and the target; it no longer reaches the generator's
`Internal parser error`. A `const` target keeps the ordinary
`Cannot assign to const variable` refusal, which now also fires through the
alias.

Cases: `check/t169_alias_element_write.c` (genuine memory, a small
initializer, embedded, alias-of-alias; each written through the alias and
read through the owner) and
`negative/alias_write_into_constant_refused.c` (encoded and const, with
`NOT-MESSAGE: Internal parser error`).

### 7.8 `break` / `continue` need a context

**Done in `d34951c`.** Refuse them where they have nothing to act on.

The semantic analyzer tracks two counters while visiting a loop body:
`breakableDepth` (a loop or, later, a switch) and `loopDepth` (a loop only).
`break` outside both, and `continue` outside a loop, are semantic errors now.
The counters are separate because a `switch` will provide only the breakable
half -- `continue` inside a switch still belongs to the enclosing loop.

Cases: `negative/break_outside_loop_refused.c` and
`negative/continue_outside_loop_refused.c`. Break/continue inside for/while
and nested loops are unchanged.

### 7.9 `do ... while`

**Done in `4f44071`.**

- parser: `parseDoWhileStatement` for `do <stmt> while ( <expr> ) ;`, plus
  `DoWhileStatementNode` and `ASTBuilder.doWhileStatement`;
- semantic: `visitDoWhileStatement` visits the body with the loop context
  (break/continue work) and then the test;
- generator: `visitDoWhileStatement` emits body -> test -> jump back to the
  BODY; `continue` targets the test. A while's back-edge targets the test.
- optimizer: `analyzeDoWhileStatement` analyzes the body/test. The
  deterministic while model is reused only when the ENTRY test is true -- the
  one case where the body/test sequence and final values are a while's.
  `simulateLoop` no longer applies the separate `for`-style update to a
  do-while (it double-stepped the loop variable). A false entry test, a body
  with side effects, break/continue or a nested loop keep the loop as it is.

Cases: `check/t170_do_while.c` (body-first, continue->test, break, nesting)
and `check/t171_do_while_optimized.c` (a do-while and a while with the same
trip count both fold; `EMIT-NOT: op lessThan`).

### 7.10 `switch ... case`

**Done in `eaa54f6`.** C semantics: fallthrough unless `break`.

- parser: `switch ( expr ) { ... }`; the body is a FLAT compound statement
  with `CaseClause` markers (a null test is `default`). One block scope for
  the whole switch, and source order is fallthrough order.
- semantic: integer discriminant; case labels are integer constant
  expressions (literals, arithmetic, chars -- identifiers are rejected, as C
  requires); duplicate case/default checks. The body is one BREAKABLE
  context, while `continue` still needs an enclosing loop.
- generator: evaluate the discriminant once, compare and jump to the matching
  case, emit the cases in source order, and place `break` targets at the end;
  `continue` is inherited from the enclosing loop.
- optimizer: the body is analysed `isUnsure` (like an unknown `if`), so a
  value is not folded to whichever case was analysed last; `CaseClause`
  analysis; `cloneAST` / scope / collect lists know `discriminant`;
  `replaceNode` replaces the discriminant (an inlined parameter); `caseValue`
  is an ATTRIBUTE so a cloned switch keeps it; loops containing a switch are
  kept out of the deterministic loop optimizations, including `do-while`
  (`tryOptimizeDoWhile` checks `containsSwitch` too).

Cases: `check/t172_switch.c` (fallthrough, default in the middle, two labels
on one statement, case expressions, char case, continue-through-switch,
nested switches, inlined function with a switch);
`check/t173_switch_loop_nesting.c` (do-while containing a switch, a switch
case containing for/while/do-while, and while -> switch -> for); and five
negative cases (duplicate case, non-constant case, duplicate default, float
discriminant, continue outside a loop).
