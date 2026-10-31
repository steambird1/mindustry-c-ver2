/*
Portable C code can include <stdbool.h>; the compiler already has the boolean
keywords, so the header is a compatibility layer.
*/
/* EXPECT: 1 0 1 */
#include <stdbool.h>

auto device message1;

void main() {
	bool yes = true;
	bool no = false;
	print(yes);
	print(no);
	print((bool)(1 + 1 == 2));
	printflush(message1);
	stop();
}
