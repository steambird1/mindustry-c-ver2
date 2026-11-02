/*
Runtime string width and precision at v150+. The helper uses @size, read and
printchar; below v150 this form is a clean error.
*/
/* CONCAT */
/* EXPECT-LINE: [   hi] */
/* EXPECT-LINE: [hi   ] */
/* EXPECT-LINE: [he] */
/* EXPECT-LINE: [    he] */
/* EXPECT-LINE: [hello] */
#include <stdio.h>

auto device message1;

void main() {
	volatile string_t s = "hello";
	volatile string_t t = "hi";

	printf("[%5s]\n", t);
	printf("[%-5s]\n", t);
	printf("[%.2s]\n", s);
	printf("[%6.2s]\n", s);
	printf("[%s]\n", s);

	printflush(message1);
	stop();
}
