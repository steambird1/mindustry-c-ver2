# Open work

What is still undone, measured rather than estimated, with a suggested
implementation where one is obvious.

This is a companion to [`PLAN_array_layout.md`](PLAN_array_layout.md), which records
what the array-layout phases did and why. That document is a design record for one
piece of work; this one is the outstanding list, and it is not limited to array layout.
Where the two overlap, this one is the one to trust for status — auditing it turned up
three claims in the plan that did not survive checking, all corrected in place and
marked below.

Everything here was measured against `94f5737` and re-checked at `f391690`. Line
numbers drift; symbol names do not, so each item cites both and the symbol is the thing
to grep for.

Reproduce the baselines from `testers/unit_tests`:

| runner | result |
|---|---|
| `node ../tools/check.mjs` | 172 passed, 0 failed (97 shape assertions, 747 pragma-invariance runs) |
| `node ../tools/negative.mjs` | 50 passed, 0 failed, 2 known gaps |
| `node ../tools/nomem.mjs` | 7 passed, 0 failed |
| `node ../tools/loadorder.mjs` | 12 passed, 0 failed, 2 exempt |
| `node ../tools/runall.mjs` | 101/101 |

The two invariants any new work has to keep:

- **No pragma may change program output.** Every `check/` case is re-run under each
  `optimize(...)` variant; none opts out.
- **Never record the same fact twice.** A test that asserts what another test already
  asserts is a test that will keep passing after the thing it guards is deleted.

## Where everything stands

One line per item, so this file can be read a piece at a time. The reasoning is where the
last column says, and the order of work is the order of the rows: **§1 and §2 first, then
§7** — §7 moves ahead only if it gets in the way of finishing them.

| item | state | detail |
|---|---|---|
| 3a — decide `chosenArrayStyle` at semantic time | not started — a split, not a hoist | §1.1 |
| 3b — delete the dead `'register'` return | not started — no dependencies | §1.2 |
| 3c — delete the six dead `'remote'` / `'names'` reads | not started — safe | §1.3 |
| 3d — `isRequireMem()` consults the canonical style | **struck — do not implement** | §1.4 |
| Phase 7: `MESSAGE:` on the 28 negative cases | not started | §2.1 |
| typedef'd data pointer, second half | not started | §2.2 |
| remote-`&x` difference regression | not started | §2.3 |
| out-of-bounds subscript | **deferred by decision** — options written down | §2.4, §7.4 |
| a case for the zero-candidate overload refusal | not started | §2.5 |
| `'x'` loses its text (§3.1) | **decided** — `int`, ASCII value; fix after §1–§2 | §7.1 |
| `for (int i = 0; …)` (§3.2) | **decided** — support it, and the empty clauses; fix after §1–§2 | §7.2 |
| `m = remote(@this, r)` (§6) | **decided** — fix it; the shape needs analysis first | §7.3 |
| §4 harness debt | fix it while testing | §4 |

---

## 1. Phase 3 — the canonical array decision

**None of 3a, 3b, 3c and 3d is done.** The plan recorded 3b as done; that was wrong, and
§1.2 below says what it actually achieved. The short version: the phase's goal is one
decision point for how an array is stored, and today that decision is still made in the
generator, re-derived a second time in semantic analysis, and — in one place — answered
correctly for a different question than the plan assumed.

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
| `availableMemory` | `remainingMemory()` (`mindcGenerator.js:3634`) and `symbol.memoryAllocationFailed`, set at `mindcGenerator.js:719` and `:743` | **no** — it depends on how much memory earlier symbols already took |
| `instructionBudget` | `instructionBudget()` (`mindcGenerator.js:3648`) — a running "instructions still available" counter | **no** |
| `lookupNames`, `lookupUnavailable` | `lookupNamesOf()` (`:3659`), `lookupUnavailable` (`:3700`, driven by `contentTable.hasOverrides`, which `mindc.js:516` only sets once the content table is built) | **no** |

So the honest shape of 3a is not a hoist. It is a **split**: decide everything that is
knowable during semantic analysis, and let the generator only *narrow* the result.

Suggested implementation:

1. Add a semantic-time `arrayStyleFor(symbol)` that handles `arrayParamRep`, `isRemote`,
   `forcedTraditionalReason` and `requestedArrayImplementation`, and calls
   `selectArrayImplementation` with the three resource inputs left `undefined`.
2. Give `selectArrayImplementation` (`mindcInfrastructure.js:3713`) a second entry point,
   `narrowArrayImplementation(style, { availableMemory, instructionBudget, lookupNames })`,
   that may only move a decision *towards* `traditional` — never away from it. That
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

### 1.2 3b — `arrayImplementationOf` still re-derives

> `arrayImplementationOf` stops re-deriving; `'register'` is retired.

`arrayImplementationOf` exists, at `mindcSemantic.js:6242`, with five call sites
(`:4253`, `:4254`, `:4353`, `:4402`, `:4449`). Measured against the item's own wording:

- it reads `arrayParamRep` — **yes**;
- it reads `chosenArrayStyle` — **no**. That field is generator-local: written only at
  `mindcGenerator.js:3772`, `:3778`, `:3812`, read only at `:3764`. Nothing in semantic
  analysis consults it, so there is nothing for this function to read even if it wanted to;
- it says so explicitly when undecided — **partly**. It returns `null` for the
  `optimize(array)` case (`:6258`), which Phase 6 added;
- it stops guessing `'memory'` — **no**. It still falls through to `return 'memory'`
  (`:6259`);
- `'register'` is retired — **no**. It is still returned at `:6257`, and nothing consumes
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

### 1.3 3c — the dead reads, and this one is safe to delete

> Delete the dead `'remote'` / `'names'` reads.

Verified, and it is the cleanest item on this list. `arrayParamRep` is written in exactly
ten places — `mindcSemantic.js:2094`, `:5562`, `:6034`, `:6454`, `:6477`, `:6482`, `:6489`,
`:6496`, and `mindcOptimizer.js:7429` — and every one of them writes `'handle'`,
`'traditional'`, or `null`. **Nothing writes `'remote'` or `'names'`.** So the six reads
are dead:

`mindcGenerator.js:1540`, `:1541`, `:3752`, `:3753`, `:3837`, `:3838`

Suggested implementation, and the trap in it. The six sites come in **two** shapes, and
conflating them is how this gets half-done.

**Four of them** — `:3752`–`:3753` and `:3837`–`:3838` — are the standalone form, and dropping
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
inside `arrayStyleFor` — the mapping onto `{ type: 'embedded', implement: 'divided' }`
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
copying `_block` / `_pos` — which `writeSymbol` would do — leaves them undefined, and the
first access then jumps through a register that is still 0, for an endless loop. Keeping
the comment is the point; the disjuncts were never what it warns about.

**Verify it by** the suite staying green. This is a pure deletion with no behaviour change
available to observe, so the tests are the only evidence there is — which is also why it
is worth doing now, while the code is fresh, rather than as part of a larger change where
a regression would be hard to attribute.

### 1.4 3d — drop it; it is answering a different question

> `isRequireMem()` consults the canonical style, so a handled array is not given memory
> of its own. This deletes the dead 4-cell block that every `remote` array currently
> allocates (`set __step 4`, `x_block`/`x_pos`) and never uses.

All three claims in that are wrong, and the item should be struck rather than
implemented.

**A `remote` array allocates no block.** Compiled output for six remote shapes — `remote
int[4]`, `remote int[3][4]`, `remote Pair p[3]`, `remote Node n[2]` (with a pointer
member), plus the local versions of each for contrast — contains no `set __step 4` and no
`x_block`/`x_pos` allocation. The *local* `struct Pair p[3]` allocates
`set g:.p_block cell1_id` / `set g:.p_pos 4`; the `remote` one allocates nothing. The
`__step` that does appear in remote output is the **pointer-stride register** used by
`__pointerForward` (`mindcGeneratorBase.js:1022`–`:1031`), emitted when a struct member
needs block-crossing arithmetic. It is not a memory block and it is not dead.

**`isRequireMem()` is not what gives an array memory.** It is `TypeInfo.isRequireMem()`
(`mindcSemantic.js:632`), and its three callers all ask it the same question — *may a
struct containing this member be held in registers?*:

- `intrinsicallyRequiresMemory()` (`:577`, used at `:585`)
- `isStrictPointerImpl()` (`:588`, used at `:606`) — and its comment at `:599`–`:604`
  states the reason outright: a struct containing an array cannot live in registers,
  because the array needs memory of its own and a recursive call may need arbitrarily many
- `mindcGenerator.js:1176`, inside `recWork`, which only runs for `isRegStruct()` types

**Its answer is load-bearing.** `check/n2.c` is the test that depends on it: a `near
struct box { int n; int data[3]; }` used recursively. Its generated code contains **four**
block-crossing pointer pairs (`__tempsym_ptr_0` through `__tempsym_ptr_1`, plus the two
`__tempsym_0/__tempsym_1` sets that feed them); the same `near struct` **without** an array
member contains **zero** `__tempsym_ptr_*` pairs. The array member is exactly what forces
the expensive addressing, and `isRequireMem()` is what says so.

Making it consult the canonical array style would therefore not delete an allocation —
there is none — and would risk permitting a struct with an array in registers, which is
the thing `:599`–`:604` explicitly rules out.

**What to do instead:** nothing. If the intent behind 3d was to stop remote arrays paying
for storage they do not use, that cost does not exist and the item closes. The
`null_block` / `null_pos` pair that *does* appear in every program is the Phase 5
unbound-handle trap and is deliberate — it is what makes an unbound handle fail loudly.

---

## 2. Phase 7 — test debt

Not started. Four items; the width/size matrix is done (`check/t13`–`t17`, `t25`, `t32`,
`t39`, `t44`, `t45`) and is not repeated here.

### 2.1 `MESSAGE:` on 30 negative cases

**30 of the 52 cases in `testers/unit_tests/negative/` have no `MESSAGE:`**; 22 do. They
pass on "did it fail" alone, so deleting the check that refuses them turns the case green
rather than red.

Two of the 30 are the reported `KNOWN-GAP`s — `ovl_auto.c` and `ovl_pragma.c`, where the
compiler accepts the program today, so there is no message to match. The other 28 are
listed with per-file reasoning in the plan's §9 and in
[`../testers/INFO.md`](../testers/INFO.md); they are not repeated here.

`negative/fn_arity_mismatch.c` is the worked example of why this matters. It was written
for the arity fix, and against the *unfixed* compiler it reported
`FAIL … refused, but with no message` — the crash produced an empty error list, which is
precisely the state a `MESSAGE:` assertion exists to catch and precisely the state a
did-it-fail assertion cannot.

Suggested implementation: work from the "say nothing" list the runner already prints.
Add one `MESSAGE:` per distinct reason, not one per error — a case that quotes every
message it happens to produce stops discriminating the moment an unrelated error appears
alongside.

### 2.2 Typedef'd **data** pointer, the second half

`check/t40_typedef_data_pointer.c` covers the first half, done in Phase 1. What is still
wanted is a typedef'd data
pointer — not a function pointer — used in a way that reaches the alias builder. Worth
re-checking rather than writing fresh, because Phases 5 and 6 added handle typedefs and
the shape may now be covered by accident.

### 2.3 A dedicated remote-`&x` regression

`check/t118_addr_of_remote.c` partly covers it. The dedicated test should assert that
remote and non-remote `&x` produce **different** code — Phase 4's actual finding was that
`remote int x[4]` and `int x[4]` generated byte-identical code, so the discriminating
assertion is the difference itself, not either side of it.

### 2.4 Out-of-bounds subscripting — a design question, not a fix

```c
int r[3];
int s[] = r;
s[5] = 7;      // silently succeeds, and prints 7
```

This is C-like permissiveness versus trapping, and it is **not** a blind fix: a bound
check changes codegen for every subscript in the language, and it changes what existing
correct programs do. It needs a decision and a scope, not a patch. Whoever takes it should
start by finding out how many of the 342 driven cases would notice — that number is the
real cost.

**Deferred by decision.** The options, and what each costs, are written down in §7.4.

### 2.5 The zero-candidate overload refusal has no case

`94f5737` made a shared name whose argument count matches no version say exactly one
thing — `No version of 'add' accepts these arguments (int, int, int, int)` — and
`f391690` closed the read past the end of the parameter list that suppressing the count
check had opened (`mindcSemantic.js:6742`, guarding the `:6743` read). Nothing in the
tree locks either one: no case matches `No version of`, and
`negative/fn_arity_mismatch.c` only asserts the *single-function* count message.

One negative case covers both — two `add` versions (2 and 3 parameters) called with four
arguments. On the compiler at `53ce864` that input threw a `TypeError` before any
diagnostic existed, which `negative.mjs` reports as `refused, but with no message`, so the
case is red on the old code and green now.

It does not cover the other half. Deleting the `shared` guard (`mindcSemantic.js:6717`)
puts the count message back *next to* `No version of …`, and a case that carries only
`MESSAGE:` lines still passes — every `MESSAGE:` still matches, because matching is
"some error", not "every error". Saying what must **not** be reported needs an annotation
the runner does not have: **`NOT-MESSAGE: <regex>`**, one per line, failing the case if
any error matches. That is a small runner change, and it is the only shape that can
assert silence.

---

## 3. Defects found while auditing, in no plan

Both were surfaced by probing the arity fix and neither is reachable from an overload.
Both are pre-existing; neither is attributable to a phase.

### 3.1 Single-quoted character literals lose their text

The lexer **does** classify `'x'` as a `char` — `int c = 'x';` is refused with
`Cannot initialize 'int' with 'char'`, so the classification is right. What is missing is
the text: `visitCharacterLiteral` (`mindcGenerator.js:4867`) reads `node.raw.replace(...)`,
and `node.raw` is `undefined` for the single-quoted form. One missing field, two different
failures depending on where the value lands:

| program | outcome |
|---|---|
| `char c = 'x';` | **runtime trap** — `Cannot read properties of undefined (reading 'string')` at `set g:.f:main.b:1.c` |
| `void p(char c) {…} p('x');` | **generator crash** — `Cannot read properties of undefined (reading 'replace')` at `mindcGenerator.js:4868` |
| `char c = "a";` | works |
| `p("a")` | works — this is what `check/t117_auto_scalar_overload.c` does |

Suggested implementation: the double-quoted form works and goes through
`visitStringLiteral`, so the fix is most likely one line in the lexer — carry the literal
text onto the node the same way the string form does — rather than anything in the
generator. Fix the lexer and both failures go at once.

**This is the only place in the test suite that exercises a `char` parameter**
(`t117_auto_scalar_overload.c`), and it uses the double-quoted form, which is why the gap
survived.

### 3.2 `for (int i = 0; …)` is not parseable

The for-init takes an expression, not a declaration:

```
Unexpected token in expression: INT 'int' | Expected SEMICOLON, but found IDENTIFIER 'i' | …
```

and it ends in a parser crash: `wrapToCompound` (`mindcParser.js:1457`) throws at `:1458`
on a `null` target, reached from `parseForStatement` (defined at `:1509`, which calls it
at `:1529`). `int i; for (i = 0; i < 2; i++)` works, and so does `while`.

Worth deciding deliberately: either the dialect does not support C99-style declarations
in for-init, in which case the parser should say so in one line instead of four plus a
crash, or it should support them. What it should not do is both.

---

## 4. Harness debt

### 4.1 Six tools import `sim.mjs` from the wrong directory

`ex6run.mjs`, `hdrsim.mjs`, `ms2run.mjs`, `ms3run.mjs`, `ms4run.mjs` and `pdtest.mjs` all
`import … from '../sim.mjs'`, but they live in `testers/tools/` next to `sim.mjs`. The
fix is `'./sim.mjs'` in six files. Deliberately left alone during the documentation pass
as out of scope; it is listed here because it is the cheapest thing on this list.

### 4.2 `runall.mjs` omits `stack/`

`runall.mjs:3` walks `['suite', 'mem', 'arr', 'arr2', 'ptr2']` — 101 cases. The three
cases in `testers/unit_tests/stack/` (`so1.c`, `so2.c`, `so3.c`, the last two using
`#pragma stackcheck`) are in no runner at all, so `#pragma stackcheck` currently has **no
coverage**: a change that broke it would be invisible to all five suites.

### 4.3 176 cases have no runner

518 `.c` files live under `testers/unit_tests`. 342 are driven: 101 by `runall.mjs`, 172
by `check.mjs`, 52 by `negative.mjs`, 7 by `nomem.mjs`, and 10 `check/peers/*.c`
programs driven by `check.mjs` on behalf of their owners. The remaining **176** are in nine
directories that no runner reads:

| dir | cases | | dir | cases |
|---|---|---|---|---|
| `t/` | 100 | | `hdr/` | 12 |
| `tests/` | 25 | | `big/` | 8 |
| `uc/` | 15 | | `exttests/` | 4 |
| `u/` | 6 | | `cases/` | 3 |
| `stack/` | 3 | | | |

`exttests/` is a special case: extension loading does not work at all, so those four cases
prove nothing either way.

### 4.4 Extension loading is dead, and `runsim.mjs` does not notice

`mindc.js:322` says `extensions (Currently not working!!!)`, and `runsim.mjs` points
`EXT_ROOT` (`:43`) at `testers/tools/src/ext/`, which does not exist, so the
`collectExtensions` that resolves includes against it (`:58`) finds nothing. So
`#include "*.js"` is silently skipped, and a case relying on an extension would pass by
accident rather than fail.

---

## 5. Deliberate non-decisions — do not "fix" these

Each was a decision, taken with the reason recorded. Re-litigating them without new
information is how they get broken.

- A handle **cannot cross processors**. The packed get/set helpers are line numbers in
  the program that built them, so a remote→local handle copy (`b = a`) yields a local
  handle whose helpers are wrong. Stays refused.
- `veccpy` is element-wise into owned storage; a handle **destination** is refused.
  `vecalias` into a handle **parameter** is refused too.
- `vecalias(&a, b)` **keeps** the `&`. A handle is one register, so the address of a
  handle is an ordinary one-word pointer — the cheapest signature available, and a
  one-store body.
- `&` on a handle is **not** refused.
- `remote` / register / embedded arrays are handles unless inlined.
- `s = b;` on a handle **parameter** is a silent no-op, pre-existing at `daf1eb0` and
  left unfixed; `negative/vecalias_into_parameter.c` records it.

## 6. Known pre-existing behaviour, not attributable to any phase

Listed so it is not re-investigated. Each was hit while probing and none has a case.

- `int al[] = mem;` alias followed by an inlined write → *"an encoded array is constant
  and cannot be written to"*.
- A handle parameter that is sized (`int s[4]`) traps; so does an unbound handle sized the
  same way.
- `m = remote(@this, r)` produces an **empty error list** and then
  `fatalError: Cannot read properties of undefined (reading 'type')`. The empty list is the
  dangerous half: it is what makes a crash indistinguishable from a clean refusal to
  anything reading `errors` alone, which is the same weakness `negative/fn_arity_mismatch.c`
  was written to close for the one path it covers.

---

## 7. Decisions on the defects in §3 and §6

Recorded so these are not re-opened, and in the order they were given: **§1 and §2 first**,
then the three below — or earlier, but only if they get in the way of finishing them.

### 7.1 `'x'` is an `int` holding its ASCII value

A single-quoted literal has type `int` and evaluates to the character's ASCII code, so
`int c = 'x';` compiles and printing `c` prints `120`.

This is more than §3.1's "carry the text onto the node". The lexer classifies `'x'` as
`char` today, which is why `int c = 'x';` is refused with `Cannot initialize 'int' with
'char'` — so there are two halves, and they land together:

- the expression's type becomes `int`. This is the half that changes behaviour: the
  refusal above disappears, and a literal used as a value is a number;
- the node carries the literal text, which is what `visitCharacterLiteral`
  (`mindcGenerator.js:4867`) reads. §3.1's generator crash and its runtime trap both go
  with it.

`char c = 'x';` then becomes an `int`→`char` initialization. Whatever the compiler already
does for `int`→`char` is the answer; if that is a refusal, it has to be a clear one-line
message and not a crash. Settle it by testing both when this is implemented.

### 7.2 `for (int i = 0; …)` parses, and every clause may be empty

Support a declaration in the for-init, and check the forms that leave a clause out:

```c
for (int i = 0; i < 2; i++) …   // declaration in init: four errors and a crash today
for (; i < 5; i++) …              // empty init
for (;; i++) …                    // empty init and empty condition
for (;;) …                        // all three empty
```

The crash is not the parse: `wrapToCompound` (`mindcParser.js:1457`) throws on a `null`
target at `:1458`, reached from `parseForStatement` (`:1509`, calling at `:1529`). So the
work is (a) parse a declaration where the init expression is expected, in the loop's own
scope, and (b) make an absent clause reach `wrapToCompound` as something it can handle.
Each empty form needs a case proving it *runs*, because "parses" and "runs" are separate
claims here: `int i; for (i = 0; …)` and `while` already work, so the generator has an
existing shape to copy.

### 7.3 `m = remote(@this, r)`

Fix it, in two steps, because the failure has two halves.

1. **The empty error list goes first.** The compiler crashes with
   `fatalError: Cannot read properties of undefined (reading 'type')` after producing no
   message at all — and an empty `errors` array is indistinguishable from a clean refusal
   to anything that reads only that (§2.1's argument for `MESSAGE:` is the same weakness,
   on the path `fn_arity_mismatch.c` covers). Whatever this call turns out to be, it must
   not be able to reach the crash without saying something.
2. **Then decide what it should be.** Accepting it means `m` takes over `r`'s
   representation; refusing it means joining the handle/array conversions that are
   deliberately refused (§5). Start from the read that produced the `undefined` — the name
   it was looking for is the fact that is missing, and that says which of the two the
   language already intends.

### 7.4 Out-of-bounds subscript — deferred, with the options written down

**Deferred by decision: no code change until it is picked up again.** What the eventual
choice is between:

1. **Leave it, and say so.** `s[5] = 7` on a three-element array is C-like
   permissiveness, documented as such. Cost: zero, and one known-wrong program keeps
   printing 7.
2. **A static check, only where the length is already known.** A constant subscript
   against an array whose length is a compile-time number (`int r[3]`, an alias of one, a
   bound handle) is refused at semantic time; a dynamic subscript (`s[i]`) is not looked
   at. Nothing that compiles today changes its generated code, so the way the driven cases
   can notice is by containing an out-of-range constant index — expected to be none, but
   counting them is the first measurement. Two facts to establish before this can be
   sized: whether `int s[] = r;` leaves `r`'s length on `s` (Phase 5 says an *unbound*
   handle has no length — it is `NaN` — and it is not obvious a bound one survives the
   assignment into the symbol), and what a static check is even supposed to say about an
   unbound handle, where the length does not exist yet.
3. **A runtime check on every subscript.** The honest fix and the expensive one: it
   changes the code of every `a[i]` in the language. Its cost is measured the only useful
   way — run the driven cases with the check in and count what changes.
4. **Opt-in** (`#pragma boundscheck`), meaningful only on top of 3. It does not break the
   no-pragma-may-change-output invariant *by construction* — a correct program prints the
   same either way — but that has to be shown by the suite rather than argued, and a
   pragma nothing runs is coverage nothing has.

2 and 3 are not exclusive: 2 is what the compiler knows for free, 3 what it would have to
pay for.
