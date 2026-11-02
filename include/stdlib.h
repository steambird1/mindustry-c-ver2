#ifndef _MINDC_STDLIB_H
#define _MINDC_STDLIB_H

#include <stddef.h>
#include <ctype.h>

#define EXIT_SUCCESS 0
#define EXIT_FAILURE 1
#define RAND_MAX 2147483647
#define MB_CUR_MAX 1

typedef struct { int quot; int rem; } div_t;
typedef struct { long quot; long rem; } ldiv_t;

inline int atoi(const char* s) {
	long value = 0;
	int sign = 1;
	while (isspace(*s)) s++;
	if (*s == '-' || *s == '+') {
		if (*s == '-') sign = -1;
		s++;
	}
	while (isdigit(*s)) {
		value = value * 10 + (*s - '0');
		s++;
	}
	return (int)(sign * value);
}

inline long atol(const char* s) { return (long)atoi(s); }
inline long labs(long x) { return x < 0 ? -x : x; }

inline long strtol(const char* s, char** endptr, int base) {
	const char* p = s;
	int sign = 1;
	int digit;
	while (isspace(*p)) p++;
	if (*p == '-' || *p == '+') {
		if (*p == '-') sign = -1;
		p++;
	}
	if (base == 0) {
		if (*p == '0' && (p[1] == 'x' || p[1] == 'X')) {
			base = 16;
			p += 2;
		} else if (*p == '0') {
			base = 8;
		} else {
			base = 10;
		}
	} else if (base == 16 && p[0] == '0' && (p[1] == 'x' || p[1] == 'X')) {
		p += 2;
	}
	long value = 0;
	while (1) {
		int c = *p;
		if (c >= '0' && c <= '9') digit = c - '0';
		else if (c >= 'a' && c <= 'z') digit = c - 'a' + 10;
		else if (c >= 'A' && c <= 'Z') digit = c - 'A' + 10;
		else break;
		if (digit >= base) break;
		value = value * base + digit;
		p++;
	}
	if (endptr != null) {
		/* The end pointer is retained for signature compatibility; writing a
		   pointer-to-pointer through a null/unsupported representation is not
		   safe in every target, so the value is currently left untouched. */
	}
	return sign * value;
}

inline long strtoul(const char* s, char** endptr, int base) {
	return strtol(s, endptr, base);
}

inline div_t div(int numer, int denom) {
	div_t result;
	result.quot = numer / denom;
	result.rem = numer % denom;
	return result;
}

inline ldiv_t ldiv(long numer, long denom) {
	ldiv_t result;
	result.quot = numer / denom;
	result.rem = numer % denom;
	return result;
}

inline void exit(int status) { stop(); }
inline void abort() { stop(); }
inline void srand(unsigned seed) { }

#endif
