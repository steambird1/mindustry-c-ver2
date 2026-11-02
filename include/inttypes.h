#ifndef _MINDC_INTTYPES_H
#define _MINDC_INTTYPES_H

#include <stdint.h>
#include <stdlib.h>

#define PRId8 "d"
#define PRIi8 "i"
#define PRIu8 "u"
#define PRIo8 "o"
#define PRIx8 "x"
#define PRIX8 "X"
#define PRId16 "d"
#define PRIi16 "i"
#define PRIu16 "u"
#define PRIo16 "o"
#define PRIx16 "x"
#define PRIX16 "X"
#define PRId32 "d"
#define PRIi32 "i"
#define PRIu32 "u"
#define PRIo32 "o"
#define PRIx32 "x"
#define PRIX32 "X"
#define PRId64 "d"
#define PRIi64 "i"
#define PRIu64 "u"
#define PRIo64 "o"
#define PRIx64 "x"
#define PRIX64 "X"
#define PRIdMAX "d"
#define PRIiMAX "i"
#define PRIuMAX "u"
#define PRIoMAX "o"
#define PRIxMAX "x"
#define PRIXMAX "X"
#define PRIdPTR "d"
#define PRIiPTR "i"
#define PRIuPTR "u"
#define PRIoPTR "o"
#define PRIxPTR "x"
#define PRIXPTR "X"

#define SCNd8 "d"
#define SCNi8 "i"
#define SCNu8 "u"
#define SCNd16 "d"
#define SCNi16 "i"
#define SCNu16 "u"
#define SCNd32 "d"
#define SCNi32 "i"
#define SCNu32 "u"
#define SCNd64 "d"
#define SCNi64 "i"
#define SCNu64 "u"
#define SCNdMAX "d"
#define SCNiMAX "i"
#define SCNuMAX "u"
#define SCNdPTR "d"
#define SCNiPTR "i"
#define SCNuPTR "u"

typedef struct { intmax_t quot; intmax_t rem; } imaxdiv_t;

inline intmax_t imaxabs(intmax_t x) { return x < 0 ? -x : x; }
inline imaxdiv_t imaxdiv(intmax_t numer, intmax_t denom) {
	imaxdiv_t result;
	result.quot = numer / denom;
	result.rem = numer % denom;
	return result;
}
inline intmax_t strtoimax(const char* s, char** endptr, int base) {
	return (intmax_t)strtol(s, endptr, base);
}
inline uintmax_t strtoumax(const char* s, char** endptr, int base) {
	return (uintmax_t)strtoul(s, endptr, base);
}

#endif
