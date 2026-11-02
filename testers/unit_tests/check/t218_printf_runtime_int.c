/*
Runtime integer width, flags and precision. Simple width is inlined; the
complex forms use the shared __printf_int helper.
*/
/* CONCAT */
/* EXPECT-LINE: [   42] */
/* EXPECT-LINE: [+0042] */
/* EXPECT-LINE: [00042] */
/* EXPECT-LINE: [42   ] */
/* EXPECT-LINE: [   42] */
/* EXPECT-LINE: [-0007] */
#include <stdio.h>

auto device message1;

void main() {
	volatile int x = 42;
	volatile int n = -7;

	printf("[%5d]\n", x);
	printf("[%+05d]\n", x);
	printf("[%.5d]\n", x);
	printf("[%-5d]\n", x);
	printf("[% 5d]\n", x);
	printf("[%05d]\n", n);

	printflush(message1);
	stop();
}
