/*
A failed assert prints its message and stops the processor; the later print is
unreachable.
*/
/* EXPECT: */
#include <assert.h>

auto device message1;

void main() {
	assert(0);
	print(9);
	printflush(message1);
	stop();
}
