/*
Native strings are `string_t` values (one cell). A `char` is a number, so
indexing a string yields a character code. `string_view` is a read-only,
length-bounded view, and concatenating into a message board returns a live view
whose length comes from `@bufferSize`.
*/
/* EXPECT: 5 104 101 6 5 hellohello10 104 111 */
#include <string.h>

auto device message1;

void main() {
	string_t s = "hello";

	print(sensor(s, @size));
	print(s[0]);
	print(s[1]);

	print(sizeof("hello"));

	string_view v = sv_of_string(s);
	print(sv_len(v));

	string_view w = concat_to_message(message1, s, s);
	print(sv_len(w));
	print(read(message1, 0));
	print(read(message1, 9));

	printflush(message1);
}
