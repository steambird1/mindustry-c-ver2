/*
`printf` is a compiler builtin: the format literal is split into a `print` with
`{n}` placeholders plus one `format` per argument. `%d`, `%i`, `%u`, `%f` and
`%s` are supported.
*/
/* EXPECT: a=3 s=hi f=2.5 */
#include <stdio.h>

auto device message1;

void main() {
	int a = 3;
	string_t s = "hi";
	printf("a=%d\ns=%s\nf=%f", a, s, 2.5);
	printflush(message1);
	stop();
}
