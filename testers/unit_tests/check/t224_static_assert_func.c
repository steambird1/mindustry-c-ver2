/*
C11/C99 declaration touches: _Static_assert/static_assert, __func__, restrict.
*/
/* EXPECT: main f 3 3 */
#include <assert.h>

auto device message1;

_Static_assert(sizeof(int) == 1, "int size");
static_assert(1 + 1 == 2, "constant expression");

int f(int * restrict p) {
	print(__func__);
	return *p;
}

void main() {
	print(__func__);
	int x = 3;
	print(f(&x));
	print(x);
	printflush(message1);
	stop();
}
