/*
Legacy entry: before `string_t` existed, `char` was the native string type.
`#pragma legacy_char_string` asks the lexer to keep that spelling for one
transition period; every other rule is unchanged.
*/
/* EXPECT: 104 105 */
#pragma legacy_char_string

auto device message1;

void main() {
	char s = "hi";
	print(s[0]);
	print(s[1]);
	printflush(message1);
	stop();
}
