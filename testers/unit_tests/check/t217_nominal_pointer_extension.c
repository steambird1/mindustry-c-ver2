/*
A JS extension can declare `nominalPointers`. The handler uses
`cg.nominalPointerOperand` to pass a register name when possible, or to write
back through a real pointer when the target lives in memory.
*/
/* EXPECT: 42 7 */
#include "nomtest.js"

auto device message1;

void main() {
	int x;
	nomstore(&x, 42);
	print(x);

	volatile int y;
	nomstore(&y, 7);
	print(y);

	printflush(message1);
	stop();
}
