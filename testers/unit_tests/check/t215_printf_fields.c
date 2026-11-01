/*
printf applies flags, width and precision when the argument is a compile-time
constant. Runtime arguments still support the plain conversions; a runtime
value with width/precision is refused instead of being printed unformatted.
*/
/* EXPECT-LINE: [ 3] */
/* EXPECT-LINE: [03] */
/* EXPECT-LINE: [+3] */
/* EXPECT-LINE: [2.50] */
/* EXPECT-LINE: [   hi] */
/* EXPECT-LINE: [hi   ] */
/* EXPECT-LINE: [%] */
/* EXPECT-LINE: a=3 */
#include <stdio.h>

auto device message1;

void main() {
	printf("[%2d]", 3);
	printf("[%02d]", 3);
	printf("[%+d]", 3);
	printf("[%.2f]", 2.5);
	printf("[%5s]", "hi");
	printf("[%-5s]", "hi");
	printf("[%%]");

	volatile int a = 3;
	printf("a=%d", a);

	printflush(message1);
	stop();
}
