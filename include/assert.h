#ifndef _MINDC_ASSERT_H
#define _MINDC_ASSERT_H

/*
`assert` is a compiler builtin: on failure it prints a message and stops the
processor. With NDEBUG defined, the macro removes calls entirely.
*/
#ifdef NDEBUG
#define assert(expr) ((void)0)
#else
/* The compiler provides the builtin itself. */
#endif

#endif
