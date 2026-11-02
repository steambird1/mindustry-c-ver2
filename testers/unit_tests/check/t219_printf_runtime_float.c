/*
Runtime float precision and width. Precision is explicit; the floating point
formatter scales, rounds, and emits the integer and fractional digits itself.
*/
/* CONCAT */
/* EXPECT-LINE: [2.50] */
/* EXPECT-LINE: [    2.50] */
/* EXPECT-LINE: [00002.50] */
/* EXPECT-LINE: [   +2.50] */
/* EXPECT-LINE: [2.50    ] */
/* EXPECT-LINE: [-2.35] */
/* EXPECT-LINE: [10.00] */
/* EXPECT-LINE: [3] */
#include <stdio.h>

auto device message1;

void main() {
	volatile float a = 2.5;
	volatile float b = -2.345;
	volatile float c = 9.999;

	printf("[%.2f]\n", a);
	printf("[%8.2f]\n", a);
	printf("[%08.2f]\n", a);
	printf("[%+8.2f]\n", a);
	printf("[%-8.2f]\n", a);
	printf("[%.2f]\n", b);
	printf("[%.2f]\n", c);
	printf("[%.0f]\n", a);

	printflush(message1);
	stop();
}
