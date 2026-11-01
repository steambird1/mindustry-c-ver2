# Types And Functions of Mindustry-C

> This is an older short reference. See
> [DIFFERENCES_FROM_C99.md](DIFFERENCES_FROM_C99.md) and
> [STANDARD_LIBRARY.md](STANDARD_LIBRARY.md) for the current, complete
> language and library reference.

Types and functions similar to C are not listed below.

## Types

Types with “*” symbol **cannot** be put in `struct` or as array type. (**It is possible that no warning or error is generated and they will be implicitly be converted to boolean values!**)

| Type | Size | Description |
| :-: | :-: | :-: |
| `null_t` | 1 | Type of `null` and can contain any value in fact |
| `device` | 1* | Handle of buildings or units |
| `content_t` | 1* | Handle of contents |
| `item_t`, `liquid_t`, `object_t`, `block_t` | 1 | Representative of item/liquid/object/block(building)s |
| `string_t` | 1 | Native **Mindustry string** value (string literals are `string_t`) |
| `char` | 1 | Ordinary character/number; `char*` is a real pointer to characters |
| Any pointer | 2 | |
| **A handle to an array** | 1 | An array that is not in this processor's memory, or has no length of its own. See [Array Handles](#array-handles). |

`sizeof` and `widthof` are not the same question:

| | Asks | `int a[4]` in memory | a handle to it |
| :-: | :-: | :-: | :-: |
| `sizeof(x)` | how many **memory cells** | 4 | **0** |
| `widthof(x)` | how many **registers** the value occupies | 2 | **1** |

A handle reports `0` for `sizeof` because it genuinely occupies no memory of its own —
it is a register holding an address. That is the whole point of it.

A `*byname` / `*byvaluename` pointer is also 1 word for `widthof`.

## Array Handles

A processor cannot read another processor's memory directly, so a *remote* array is
represented as a **handle**: one register packing the entry points of the generated
`get`/`set` helper, plus the length and the element size. `remote` arrays, `embedded`
arrays, `lookup` arrays and arrays with no length of their own are all handles unless
they get inlined.

This is visible to you in exactly one way: **`widthof`**.

### `int a[];` — an array name waiting to be bound

Declared with no size and no initializer, `a` is not an array of its own. It is a
**one-word cell** that will later name one:

```c
int mem[4] = {1, 2, 3, 4};
int a[];              // a cell, not an array

void main() {
    a = mem;          // bind it -- the & is not needed here
    a[2] = 99;
    print(mem[2]);    // 99: a and mem name ONE array
    print(lenof(a));  // 4: taken from the binding, never written in the source
}
```

Rules:

- Bind it with `a = someArray;` or `vecalias(&a, someArray);` before you use it.
  Using it before binding, or never binding it at all, is a **compile error** — not a
  run-time failure.
- It is a *name*, not storage, so **re-binding is allowed** and is the point of
  keeping the cell: `a = other;` leaves `mem` untouched.
- It costs 1 register, plus the instructions that pack the handle. Taking `&a` costs
  nothing extra, because either form needs a cell to write into.

A handle can be bound to a handle (`b = a;`) — the value *is* the handle, so there is
nothing to re-pack. A handle **cannot cross processors**: the helper line numbers it
packs mean nothing on another processor, so `a = @this;` is refused.

## Functions

C functions supported: `asm`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `ceil`, `floor`, `sqrt`, `abs`, `memcpy`.
Deprecated functions are not listed below.

### Array Intrinsics

These are compiler intrinsics, not library calls: they lower to instructions, not to a call.

| Signature | Remarks |
| :-: | :-: |
| `int lenof(array)` | Number of elements in a dimension: `lenof(grid)` is the row count, `lenof(grid[0])` is the length of a row. Takes an **array**, not a pointer — `lenof` on a pointer is an error. |
| `int widthof(type_or_expr)` | Registers the value occupies. Works on a type name (`widthof(int[4])`) or on an expression. |

### Binding And Copying

| Signature | Remarks |
| :-: | :-: |
| `void vecalias(int *dst, int src[])` | Bind the handle cell `*dst` to the array `src`. This is `dst = src` written as an intrinsic; the `&` is **required**, because a handle is bound by writing into the cell that holds it. |
| `void veccpy(int dst[N], int src[M])` | Copy elements `dst[i] = src[i]`, element by element. `M <= N` is checked **statically** when both lengths are known; when a length lives only inside a packed handle, the smaller count is copied instead. |

`vecalias(&a, b);` and `a = b;` are the same binding. Use whichever reads better.

```c
int mem[4] = {5, 6, 7, 8};
int a[];
void main() {
    vecalias(&a, mem);
    a[1] = 42;
    print(mem[1]);    // 42
}

int src[3] = {1, 2, 3};
int dst[5];
void main2() {
    veccpy(dst, src);
    print(dst[2]);    // 3
    print(dst[3]);    // 0: only 3 of the 5 slots are touched
}
```

Two things these deliberately refuse, because "it compiled" would be worse than an error:

- **`veccpy` into a handle.** A handle is a *name*, not storage — it has no elements
  of its own to write. Bind it with `vecalias(&a, b);` instead.
- **`vecalias` into a handle *parameter*,** and into anything the program does not own.
  Only a cell that is genuinely unbound can be bound.


### Mindustry System Calls

The order of these functions are defined as follows:

- If the original instruction in Mindustry has return values placed as their first parameter, then this parameter is omitted and replaced by the function's return values.
- Otherwise (for `ulocate`), they should be given as pointers.

`...` means variant parameters: In order of Mindustry code text instructions lays all **necessary** parameters.

| Function | Remarks |
| :-: | :-: |
| `void draw(const string_t action, ...)` | **`action` must be a string literal.** |
| `void drawflush(device target)` | |
| `void printflush(device target)` | |
| `device getlink(int id)` | |
| `void control(const string_t action, device target, ...)` | **`action` must be a string literal.** |
| `device radar(const string_t condit1, const string_t condit2, const string_t condit3, const string_t sorting, device from, int order)` | Relevant strings **must be string literal.** |
| `null_t sensor(device source, content_t data)` | The return value might be of any type, so cast it on your own. |
| `content_t lookup(const string_t category, int id)` | **`category` must be a string literal.** |
| `void wait(float time)` | |
| `void stop()` | |
| `void end()` | |
| `void ubind(content_t unit)` | |
| `void ucontrol(const string_t action, device target, ...)` | **`action` must be a string literal.** |
| `void ulocate(const string_t action, ...)` | **`action` must be a string literal.** (See remarks and examples to learn more) |
| `device uradar(const string_t condit1, const string_t condit2, const string_t condit3, const string_t sorting,int reserved, int order)` | `reserved` should always be 0. |
| `float adiff(float a, float b)` | Act as "angle diff". |
| `void* memsp(device cell, int location)` | Return a pointer pointing to a particular memory space. |

* `ulocate`: The last 4 parameters represent the output of resultX, resultY, found and building device handle.
  Pass them as nominal pointers (`&x`, `&found`, `&building`). The old `(volatile type*)` output-cast form has been removed.
  See examples to learn more.
