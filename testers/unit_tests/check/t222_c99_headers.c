/*
C99 compatibility headers: stddef/stdint/limits/float/ctype/stdlib/string/
inttypes/assert/math. The test stays with one value per print so the normal
EXPECT comparison is enough.
*/
/* EXPECT: 3 42 2147483647 8 2 1 65 -12 31 2 1 2 0 1 1 0 3 3 -2 d */
#include <stddef.h>
#include <stdint.h>
#include <limits.h>
#include <float.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include <assert.h>
#include <math.h>

auto device message1;

void main() {
	size_t n = 3;
	int32_t x = 42;
	print(n);
	print(x);
	print(INT32_MAX);
	print(CHAR_BIT);
	print(FLT_RADIX);

	print(isdigit('7'));
	print(toupper('a'));
	print(atoi("-12"));
	print(strtol("0x1f", null, 16));

	div_t d = div(7, 3);
	print(d.quot);
	print(d.rem);

	char a[8];
	strncpy(a, "hi", 8);
	print(strlen(a));

	char b[] = "ab";
	char c[] = "ac";
	print(strncmp(b, c, 1));
	print(strchr(b, 'b') != null);

	char h[] = "hello";
	char e[] = "ell";
	print(strstr(h, e) != null);
	print(memcmp(b, c, 1) < 0);

	print((int)fabs(-3.5));
	print((int)round(2.5));
	print((int)trunc(-2.7));
	print(PRId32);

	assert(1);

	printflush(message1);
	stop();
}
