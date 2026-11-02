/*
Macro operators: # stringification, ## token pasting and __VA_ARGS__.
*/
/* EXPECT: 42 hello 3 7 5 */
#define STR(x) #x
#define XSTR(x) STR(x)
#define VERSION 42
#define CAT(a, b) a##b
#define CAT3(a, b, c) a##b##c
#define ADD(x, ...) (x + __VA_ARGS__)

#include <stdio.h>

auto device message1;

void main() {
	print(XSTR(VERSION));
	print(STR(hello));

	int CAT(my, var) = 3;
	print(myvar);

	int CAT3(a, b, c) = 7;
	print(abc);

	print(ADD(2, 3));

	printflush(message1);
	stop();
}
