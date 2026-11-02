#ifndef _MINDC_STDDEF_H
#define _MINDC_STDDEF_H

/*
The C-compatible subset of stddef.h. All values are one Mindustry cell; the
typedefs exist so portable C sources compile. `size_t` is one unsigned cell.
*/
typedef unsigned size_t;
typedef int ptrdiff_t;

#ifdef __MINDUSTRY__
#define NULL null
#else
#define NULL ((void*)0)
#endif

#endif
