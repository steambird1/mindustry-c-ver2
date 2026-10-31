# mindustry-c: A JavaScript program compiling C code to Mindustry Assembly

[中文 README](https://github.com/steambird1/mindustry-c/blob/main/docs/LiyueSprache/README.md)

## What is Mindustry-C?

Mindustry-C compiles a C-like dialect to Mindustry logic instructions. It is
not a hosted C implementation: there is no operating system, file I/O, or
dynamic allocation; values live in processor registers or linked memory
blocks. The language and library references below describe the exact
differences.

## Documentation

- [Language differences from C99](docs/DIFFERENCES_FROM_C99.md)
- [Standard library and built-in reference](docs/STANDARD_LIBRARY.md)
- [Types and functions (short, older)](docs/TYPES_AND_FUNCTIONS.md)
- [ASM statement](docs/asm.md)
- [Pseudo list](docs/PSEUDO_LIST.md)
- Current work and known gaps: [OPEN_WORK.md](docs/OPEN_WORK.md)

## Current status

Complex types are supported: structs, fixed arrays and array handles,
memory/register/encoded/remote array layouts, ordinary address pointers and
one-word `byname` pointers, function pointers, and `remote` variables. Some
C99 forms are intentionally unsupported or limited; the language reference is
authoritative.

----

Please notice that: Mindustry-C has a number AI-generated code. The AI tool used in this project is DeepSeek (for individuals), Hunyuan 4 Preview and OpenCode's Big Pickle.

> I have no time to code completely, though. I've written only prompts and some parts of code -- However, the percentage of AI code is surging because agents ARE reliable at least so far.
> (AI is just no so realiable as I've expected)
> * This piece of text is clarified on 19 Mar.

Mindustry-C aims to compile C code (more precisely, a C dialect I've defined) to Mindustry Assembly, a brain-racking language for most of us.

There have been many similar softwares aiming at using languages like C/C++ (alike grammar) or Python to code in Mindustry, but they aren't so effective. So here we are.

## Installation

Installation is not needed. Just download `main.html` and all javascript files and ensure that you have Internet connection (UI requires Bootstrap from CDN; or the display might be a little bit weird).

Then, **start a server and browse `main.html` from it (or you will be blocked by CORS policy of browsers)**.

(If you use Windows, then `start.bat` can do these for you.)

Execute the following command in the root directory of the download files if you have python 3:

```
python -m http.server
```

Or [if you want to make it 100% steambird-made](https://github.com/steambird1/MinServer-Old).

For grammar introduction (about the features unique to Mindustry-C) and examples, see the documentation links above and the `testers` directory.

## Features about Mindustry-C

- C-like core: functions, structs, pointers, arrays, `typedef`,
  `for`/`while`/`do-while`/`switch`, `break`/`continue`/`return`.
- C99 conveniences: `//` comments, `bool`/`true`/`false`, `inline`,
  declarations in `for` initializers.
- Storage durations: automatic locals per call; `static` within one run;
  `persistent` across processor restarts; ordinary file-scope variables reset
  each run.
- Preprocessor: `#define` (object-like and function-like), `#undef`,
  `#if`/`#elif`/`#else`/`#endif`, `#ifdef`/`#ifndef`, `#include`, `#pragma`.
  Variadic macros are not supported; `goto` and VLAs are rejected.
- Mindustry types: `device`, `content_t`, `null_t`, `item_t`, `liquid_t`,
  `unit_t`, `block_t`, plus `remote` bindings.
- `auto device` startup binding, plus `getlink` for runtime link access.
- Arrays: fixed-size arrays, deduced last dimension, open array handles,
  and `traditional` / `embedded` / `encoded` / lookup layouts.
- Pointers: ordinary two-word address pointers and one-word `byname` name
  pointers; `#pragma optimize(pointer)` and `struct_pointer`.
- `auto` parameters, `auto` struct members, and function overloading.
- `remote` access to another processor's variables, arrays, and pointers.
- Memory blocks, function stack, recursion (memory-heavy), `asm`, and raw
  Mindustry instructions.
- Optimizer: constant folding, loop simulation, constant switch folding,
  encoded switch dispatch, dead-code removal, inlining. Loop unrolling is
  deliberately not done.

## Notice

1. Memory is required for:

- `volatile` variables;
- recursive functions (all their symbols go to memory);
- `array("traditional", ...)` arrays;
- ordinary `&x` pointers that cannot use a name;
- objects too large or otherwise unsuitable for registers.

Arrays can also live in registers, encoded strings, or a one-word handle, so
“array” no longer implies a memory block.

2. A non-recursive function can keep its locals in registers, but arrays,
`volatile` variables, and address-taken locals may still require memory.

3. A normal pointer is two words (block + position). A `byname` name pointer
or an array handle is one word; use `widthof` to see the difference.

4. `union` and bit-fields are parsed, but are not a stable C99-compatible
subset yet: do not rely on member aliasing or bit packing.

Recursion is supported but expensive and less predictable; prefer globals and
iterative code. Avoid declaring memory-demanding variables in non-main
functions when a global would do. Memory layouts may also reserve block
metadata; small arrays can often use register or encoded layouts instead.

## An Overview of Special Grammar

### Specialized for Mindustry

- `device` describes building/unit handles; `content_t` describes content
  handles. `item_t`, `liquid_t`, `unit_t`, and `block_t` are narrower content
  types; `null_t` can hold any value.
- Use `auto device conveyor1;` to bind a linked device at startup (`auto` is
  required).
- Use file-scope `extern` to keep a processor variable visible to other
  processors by name; `remote(processor, name)` binds such a variable/array/
  pointer on the other side. This is not C external linkage.
- `remote int *p` and `int *remote p` mean different things: which side stores
  the pointer depends on where `remote` is written.
- `int *byname p` / `byname(&x)` stores a variable name in one register; such a
  pointer cannot be used for pointer arithmetic.
- `(volatile type*)(object)` passes a register raw to built-ins such as
  `ulocate`.
- Function pointers need a concrete `typedef`; an `auto` function needs a
  concrete version to take its address.
- `array("...", {...})` requests an array layout; see the language reference
  for the available layouts.

### Different from C/C++

- Empty initializer lists are not a reliable form. `int a[] = {1, 2, 3};` is
  supported: the last dimension is deduced from the initializer.
- String literals are `char` values, not `char *`; there are no C string
  functions.
- The complete list is in [DIFFERENCES_FROM_C99.md](docs/DIFFERENCES_FROM_C99.md).
