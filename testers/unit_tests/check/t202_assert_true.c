/*
`assert(true)` does nothing; `__FILE__` and `__LINE__` are predefined.
*/
/* EXPECT: <source> 1 9 */
#include <assert.h>

auto device message1;

void main() {
	assert(1);
	print(__FILE__);
	print(__LINE__ > 0);
	print(9);
	printflush(message1);
	stop();
}
