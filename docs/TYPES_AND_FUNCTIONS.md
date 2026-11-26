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

| | Asks | `int a[4]` in memory | a runtime handle to it |
| :-: | :-: | :-: | :-: |
| `sizeof(x)` | how many **cells the value itself occupies** | 4 | **1** |
| `widthof(x)` | how many **registers** the value occupies | 2 | **1** |

A runtime handle is one cell — the packed value itself. `sizeof` answers the size of
that value, not the number of elements behind it; `lenof` asks the array question and
reads the length carried in the handle.

A compile-time alias (`int s[] = mem;`) is still the array itself, so `sizeof(s)` is
the array's cell count. Only a runtime handle (`int h[]; h = mem;`) is one cell.

A `*byname` / `*byvaluename` pointer is also 1 word for `widthof`.

## Array Handles

A processor cannot read another processor's memory directly, so a *remote* array is
represented as a **handle**: one register packing the entry points of the generated
`get`/`set` helper, plus the length and (for a slice) the element it starts at.
`remote` arrays, `embedded` arrays, `lookup` arrays and arrays with no length of
their own are all handles unless they get inlined.

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
nothing to re-pack. The declaration form is the same copy: `int b[] = h;`. A handle
**cannot cross processors**: the helper line numbers it packs mean nothing on another
processor, so `a = @this;` is refused.

A handle can also be chosen at run time:

```c
int a[5], b[3];
int h[] = cond ? a : b;   // h is a runtime handle

h = pick ? a : b;         // rebinding is allowed
```

The conditional selects the packed handle (helpers, length and start offset), not an
array copy. If both branches have the same known shape the static length is kept;
otherwise the length is read from the handle at run time. `sizeof(h)` is `1` in either
case.

### Slices

A slice is a **view of an element sequence**, named by the same one-cell handle.
The spelling says which operation you asked for:

```c
int grid[2][3] = {{1,2,3}, {4,5,6}};
int a[6] = {10,20,30,40,50,60};

int row[]  = grid[1];         // drop a dimension: the second row, lenof 3
int tail[] = &a[3];           // the ADDRESS of a[3], read as an array tail
int rest[] = a + 2;           // the same, through pointer arithmetic
int part[] = slice(a, 1, 4);  // an explicit [1, 4) range: lenof 3
```

Rules:

- **`slice(x, start[, end])` is the general form.** `end` is exclusive; omitting it
  means "to the end of `x`". It works on a memory array, an `embedded` array and a
  handle, because it is defined on the element **sequence**, not on an address.
- **`g[i]` drops a dimension.** It flattens the remaining ones: `grid[i]` is a 1-D
  row, and from a 3-D array `g3[i]` is the flattened 2-D remainder (`lenof` is the
  product of the remaining dimensions). A register layout can carry it too — the
  root's helper is an index-to-element description (`select`, or lookup), and the
  slice offset is simply added to the index.
- **`&a[i]` and `a + i` are addresses**, and only a **memory** array has one. On an
  `embedded` array they are refused (`&e[i]` has no address; `e + i` would step
  registers), with a message pointing at `slice(e, i)`.
- The start may be a run-time value. The length is then packed into the handle at
  run time (`slice(a, i, j)` costs two or three instructions more, not a new
  helper).
- The start offset rides in the value, so `int k[] = h;` copies keep pointing where
  they did even after `h` is rebound, and `slice(h, i)` composes with the offset `h`
  already carries.
- The bound value IS the view: `lenof`, `sizeof` and `slice(a, 1, 4)[i]` all work
  on it directly. A run-time bound is not a compile-time number: `lenof` of it is
  answered at run time, and `sizeof` answers the handle's own width (`1`) — bind it
  first (`int b[] = ...;`) if you need the array's cell count. Binding it to an open handle (`int b[] = ...`) keeps the
  length for `lenof`; a **concrete** array (`int b[3] = slice(...)`) is refused —
  it has storage of its own, so use `veccpy(b, slice(...))` to copy the elements.
- The root must be readable through a helper: a remote array is refused (helper
  line numbers are local), and so are `encoded` / `lookup` constant tables (there
  is no writable storage to view) and arrays whose elements occupy several
  registers (a handle reaches one cell at a time).
- The start is 12 bits wide (4095 elements); a constant start beyond that is refused
  at compile time. A run-time start is not checked.
- Struct member arrays are not slices yet: bound the member from a function that
  takes it by name, or give the destination its own storage.

### Read-only handles

`const` on a handle is a property of the **value**, not only of the name: a handle
that may point at a constant table can have no `set` helper, so every write through
it is refused at compile time.

```c
const int encoded[3] = array("encoded", {1, 2, 3});
int writable[3] = {4, 5, 6};

const int h[] = cond ? encoded : writable;   // read-only: one branch is a table
print(h[0]);                                 // fine
print(lenof(h));                             // fine
h[0] = 9;                                    // compile error
```

- A conditional is read-only when **either** branch is; a copy of a read-only handle
  must be declared `const` too, and passing one to `int s[]` is refused (declare the
  parameter `const int s[]` if the callee does not write).
- `const int s[] = b;` is a read-only **view** of `b`; `sizeof(s)` is still the
  array's own cell count.
- `veccpy` and `vecalias` into a read-only handle are refused.

## Functions

C functions supported: `asm`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `ceil`, `floor`, `sqrt`, `abs`, `memcpy`.
Deprecated functions are not listed below.

### Array Intrinsics

These are compiler intrinsics, not library calls: they lower to instructions, not to a call.
Like `vecalias` / `veccpy`, `slice` is a reserved builtin name.

| Signature | Remarks |
| :-: | :-: |
| `int lenof(array)` | Number of elements in a dimension: `lenof(grid)` is the row count, `lenof(grid[0])` is the length of a row. Takes an **array**, not a pointer — `lenof` on a pointer is an error. |
| `int widthof(type_or_expr)` | Registers the value occupies. Works on a type name (`widthof(int[4])`) or on an expression. |
| `array slice(array x, int start[, int end])` | A **view** of `x`'s element sequence, starting at `start` and ending before `end` (omitted: to the end). Returns a handle, so it works on a memory array, an `embedded` array and another handle. See [Slices](#slices). |

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
