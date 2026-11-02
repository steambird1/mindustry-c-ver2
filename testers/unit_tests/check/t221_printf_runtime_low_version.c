/*
Runtime width/precision also works at target 148 for integers and floats.
Only the %s helper needs v150+.
*/
/* VERSION: 148 */
/* NO-INVARIANT */
/* CONCAT */
/* EXPECT-LINE: [   42] */
/* EXPECT-LINE: [00042] */
/* EXPECT-LINE: [2.50] */
/* EXPECT-LINE: [    2.50] */
#include <stdio.h>

auto device message1;

void main() {
	volatile int i = 42;
	volatile float f = 2.5;

	printf("[%5d]\n", i);
	printf("[%.5d]\n", i);
	printf("[%.2f]\n", f);
	printf("[%8.2f]\n", f);

	printflush(message1);
	stop();
}
