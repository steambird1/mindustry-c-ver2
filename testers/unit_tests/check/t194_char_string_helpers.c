/*
C character-buffer helpers live in <string.h> and operate on real `char*`
arrays, not on native `string_t` values.
*/
/* EXPECT: 4 0 97 100 */
#include <string.h>

auto device message1;

void main() {
	char a[16] = "ab";
	strcat(a, "cd");

	char b[8];
	strcpy(b, a);

	print(strlen(b));
	print(strcmp(b, "abcd"));
	print(b[0]);
	print(b[3]);

	printflush(message1);
	stop();
}
