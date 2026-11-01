/*
Low-version stdlib: headers work for everything that does not need v150
instructions. `printf` below v150 is lowered to separate `print` instructions;
Mindustry's `print` has no terminator, so the pieces concatenate. Constant
conversions are formatted at compile time.
*/
/* VERSION: 148 */
/* NO-INVARIANT */
/* EXPECT: 5 1 7 hello x= 3 [03] */
/* EMIT-NOT: format */
#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

auto device message1;

void main() {
	char s[] = "hello";
	print(strlen(s));

	bool b = true;
	print(b);

	assert(1);
	print(7);

	printf("hello");

	volatile int x = 3;
	printf("x=%d", x);

	printf("[%02d]", 3);

	printflush(message1);
	stop();
}
