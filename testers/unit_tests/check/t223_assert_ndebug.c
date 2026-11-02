/*
With NDEBUG defined, assert(expr) disappears at preprocessing time. A failing
assert here must not stop the processor.
*/
/* EXPECT: 7 */
#define NDEBUG
#include <assert.h>

auto device message1;

void main() {
	assert(0);
	print(7);
	printflush(message1);
	stop();
}
