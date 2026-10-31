# Mindustry-C Guide

Mindustry-C is just like normal C, with a few special features listed below to make it suitable for Mindustry. This document helps you understand Mindustry-C quickly.

## First of All: Why Mindustry-C?

### Why is Mindustry-C Created?

Personally, I am a Mindustry player and have been looking for ways to simplify logic programming. Here are a few alternatives available on Github which I found not so useful:

- `mlogjs`: Easy to use (online compiler) but has bad support on recursive functions and memory operations or list (they have macros)
- `pyndustric`: Few array or complex structure supports

So here it is.

### Who is the Most Suitable for Mindustry-C?

If your logic is becoming sufficiently complex or needs dynamic adjustment but does not care much about speed, then Mindustry-C might be your choice, as it provides a large practical subset of C including functions, structures, arrays, pointers, handles and remote-backed values.

## Introduction

Mindustry-C is just like normal C, as I've said before. The standard library is different: it is mostly Mindustry instructions and custom headers, and only a few C functions (such as `memcpy` and some math functions) keep their C names and behavior. See [STANDARD_LIBRARY.md](STANDARD_LIBRARY.md). For example:

```
auto device message1;  // Declare message1 device useable in the program

void main() {          // The return type does not matter, but 'void' is recommended.
  print("Hello world!");  // There's no 'printf'.
  printflush(message1);  // Like original mindustry logic, printflush must be called.
}
```

In examples of **`testers` directory**, you can see more practical examples.

Also, names such as `@copper` are `content_t`/`item_t` handles, while names such as `@time` are numeric runtime values; both are Mindustry built-ins.

We also have `null_t` which can refer to any type of data (by default used to contain `null`).

Here provides a short reference table for some of the useful functions:

| Function | Usage |
| :-: | :-: |
| `null_t sensor(device target, content_t data)` | Sensor data from building |
| `void ubind(content_t type)` | Bind a unit |
| ... | |

(Refer to [this](https://github.com/steambird1/mindustry-c/blob/main/docs/TYPES_AND_FUNCTIONS.md) to learn more.)

For the authoritative language differences and the library reference, see
[DIFFERENCES_FROM_C99.md](DIFFERENCES_FROM_C99.md) and
[STANDARD_LIBRARY.md](STANDARD_LIBRARY.md).

## Major Differences

> **Note:** this section predates the current compiler. See
> [DIFFERENCES_FROM_C99.md](DIFFERENCES_FROM_C99.md) for the authoritative
> list; some old limitations below no longer apply.

The following older examples are kept for history; check the new document for
the current behavior:

- `int a[5] = {};` — an empty initializer is not a reliable form; write the
  values or the size explicitly.
- `int a[] = {1,2,3};` — **now supported**; the last dimension is deduced
  from the initializer.
- `struct a { struct b {} c; };` — embedded struct/union remains limited;
  give the inner struct a name.

There are some additional features:

- `(volatile type)` type cast will present everything as its raw form (mainly used for builtin calls, especially `ulocate`)
- `int a[];` — an array declared with no size and no initializer — is a one-word **cell** that later names an array. Bind it with `a = b;` or `vecalias(&a, b);` before using it. See [Array Handles](TYPES_AND_FUNCTIONS.md#array-handles)
- `widthof(x)` tells you how many **registers** a value occupies, which is not the same question as `sizeof(x)` (memory cells) for arrays and for `*byname` pointers
- `vecalias(&a, b)` and `veccpy(a, b)` bind and copy arrays at the intrinsic level
- `do { ... } while (...)` loops are supported: the body runs once before the test
- `switch (x) { case ...: ... default: ... }` follows C: fallthrough unless `break`
- `static` is run-local (shared across calls in one pass); `persistent` survives the processor restart; ordinary file-scope variables reset each run

*Note: `int a[] = {1, 2, 3};` is supported: the last dimension comes from the
initializer. An empty initializer list is not a reliable form; write values or
an explicit size.*

## Coding Style

Mindustry-C is not a full optimizing compiler, but it does constant folding, loop simulation, constant switch folding, encoded switch dispatch, dead-code removal and inlining. The following styles still help keep execution and memory predictable:

### 1. Prevent using recursion

Recursion functions in Mindustry-C will be automatically labelled and compiled specially, resulting in the following consequences:

- All symbols (including temporary symbols) of relevant functions will be stored in memory instead of registers, slowing down the execution of program and increasing the stress of memory use.
- Stack override is **silent**.
- Some code might result in unexpected results as recursion is not well supported currently.

*Note:* it is also recommended to prevent using function calls unless necessary because automatic inline is limited so far, and function call results in complexity.

### 2. Use global variables (especially for arrays and structures)

Memory of global variables will be assigned exactly once; however, the variables in the functions will be assigned more than once, resulting in time complexity increment.

*Note:* Use no more arrays and structures than necessary; register or encoded layouts can reduce memory pressure, but large aggregates still cost instructions and memory.*

### 3. Control the Control Flow

Although Mindustry logic will executed from the beginning after termination, it is recommended to use a `while(true)` loop to permanently hold the control flow to prevent initial initializations.
