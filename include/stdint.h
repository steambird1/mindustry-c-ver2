#ifndef _MINDC_STDINT_H
#define _MINDC_STDINT_H

/*
Fixed-width names are compatibility aliases. Mindustry-C scalars are one
double-backed cell, so these types do not enforce the usual C widths or
overflow behaviour. The limits below describe the C names, not the machine.
*/
typedef int int8_t;
typedef unsigned uint8_t;
typedef int int16_t;
typedef unsigned uint16_t;
typedef int int32_t;
typedef unsigned uint32_t;
typedef long int64_t;
typedef unsigned uint64_t;

typedef int int_least8_t;
typedef unsigned uint_least8_t;
typedef int int_least16_t;
typedef unsigned uint_least16_t;
typedef int int_least32_t;
typedef unsigned uint_least32_t;
typedef long int_least64_t;
typedef unsigned uint_least64_t;

typedef int int_fast8_t;
typedef unsigned uint_fast8_t;
typedef int int_fast16_t;
typedef unsigned uint_fast16_t;
typedef int int_fast32_t;
typedef unsigned uint_fast32_t;
typedef long int_fast64_t;
typedef unsigned uint_fast64_t;

typedef int intptr_t;
typedef unsigned uintptr_t;
typedef long intmax_t;
typedef unsigned uintmax_t;

#define INT8_MIN (-127 - 1)
#define INT8_MAX 127
#define UINT8_MAX 255
#define INT16_MIN (-32767 - 1)
#define INT16_MAX 32767
#define UINT16_MAX 65535
#define INT32_MIN (-2147483647 - 1)
#define INT32_MAX 2147483647
#define UINT32_MAX 4294967295
#define INT64_MIN (-9223372036854775807 - 1)
#define INT64_MAX 9223372036854775807
#define UINT64_MAX 18446744073709551615

#define INT_LEAST8_MIN INT8_MIN
#define INT_LEAST8_MAX INT8_MAX
#define UINT_LEAST8_MAX UINT8_MAX
#define INT_LEAST16_MIN INT16_MIN
#define INT_LEAST16_MAX INT16_MAX
#define UINT_LEAST16_MAX UINT16_MAX
#define INT_LEAST32_MIN INT32_MIN
#define INT_LEAST32_MAX INT32_MAX
#define UINT_LEAST32_MAX UINT32_MAX
#define INT_LEAST64_MIN INT64_MIN
#define INT_LEAST64_MAX INT64_MAX
#define UINT_LEAST64_MAX UINT64_MAX

#define INT_FAST8_MIN INT8_MIN
#define INT_FAST8_MAX INT8_MAX
#define UINT_FAST8_MAX UINT8_MAX
#define INT_FAST16_MIN INT16_MIN
#define INT_FAST16_MAX INT16_MAX
#define UINT_FAST16_MAX UINT16_MAX
#define INT_FAST32_MIN INT32_MIN
#define INT_FAST32_MAX INT32_MAX
#define UINT_FAST32_MAX UINT32_MAX
#define INT_FAST64_MIN INT64_MIN
#define INT_FAST64_MAX INT64_MAX
#define UINT_FAST64_MAX UINT64_MAX

#define INTPTR_MIN (-2147483647 - 1)
#define INTPTR_MAX 2147483647
#define UINTPTR_MAX 4294967295
#define PTRDIFF_MIN (-2147483647 - 1)
#define PTRDIFF_MAX 2147483647
#define SIZE_MAX 4294967295

#define INTMAX_MIN INT64_MIN
#define INTMAX_MAX INT64_MAX
#define UINTMAX_MAX UINT64_MAX

#define INT8_C(c) c
#define UINT8_C(c) c
#define INT16_C(c) c
#define UINT16_C(c) c
#define INT32_C(c) c
#define UINT32_C(c) c
#define INT64_C(c) c
#define UINT64_C(c) c
#define INTMAX_C(c) c
#define UINTMAX_C(c) c

#endif
