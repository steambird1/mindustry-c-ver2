#ifndef _MINDC_STDIO_H
#define _MINDC_STDIO_H

/*
`printf` is a compiler builtin (a user function cannot be variadic in this
dialect). `print` and `printflush` are Mindustry builtins. This header exists
so portable C sources can keep `#include <stdio.h>`.

On v150+ `printf` uses one `print` plus `format`; below v150 it is lowered to
several `print` instructions. Constant arguments are folded at compile time.
Runtime integer width, explicit-precision floats and v150+ string width/precision
are formatted by generated code or the registered `__printf_*` helpers.
*/

#endif
