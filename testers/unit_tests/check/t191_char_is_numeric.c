/*
`char` is a number again; `char*` is an ordinary writable pointer, and
`char a[] = "..."` is a NUL-terminated C character array. A string literal is
read-only, so only `const char*` may point at it directly.
*/
/* EXPECT: 65 66 67 88 105 0 105 2 3 72 1 2 */
auto device message1;

void main() {
	char c = 'A';
	print(c);
	print(c + 1);
	print(c + 2);

	char a[] = "Hi";
	a[0] = 'X';
	print(a[0]);
	print(a[1]);
	print(a[2]);

	char* p = a;
	p = p + 1;
	print(*p);
	print(widthof(p));

	print(sizeof("Hi"));

	const char* q = "Hi";
	print(q[0]);

	print(sizeof(char));
	print(sizeof(char*));

	printflush(message1);
	stop();
}
