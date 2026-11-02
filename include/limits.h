#ifndef _MINDC_LIMITS_H
#define _MINDC_LIMITS_H

/*
VALUES IN C NAMES, NOT HARDWARE WIDTHS.

Mindustry-C scalars are one cell backed by a double. These macros let portable
C code compile; do not use them to reason about wraparound or storage width.
*/
#define CHAR_BIT 8
#define SCHAR_MIN (-127 - 1)
#define SCHAR_MAX 127
#define UCHAR_MAX 255
#define CHAR_MIN (-127 - 1)
#define CHAR_MAX 127
#define MB_LEN_MAX 1
#define SHRT_MIN (-32767 - 1)
#define SHRT_MAX 32767
#define USHRT_MAX 65535
#define INT_MIN (-2147483647 - 1)
#define INT_MAX 2147483647
#define UINT_MAX 4294967295U
#define LONG_MIN (-2147483647L - 1L)
#define LONG_MAX 2147483647L
#define ULONG_MAX 4294967295U
#define LLONG_MIN (-9223372036854775807 - 1)
#define LLONG_MAX 9223372036854775807
#define ULLONG_MAX 18446744073709551615

#endif
