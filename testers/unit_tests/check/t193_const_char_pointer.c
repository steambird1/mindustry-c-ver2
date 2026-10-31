/*
A literal can be used where `const char*` is expected: it is materialised as a
read-only char array. The same literal remains a one-cell `string_t` in string
contexts. Mutable char arrays remain ordinary writable pointers.
*/
/* EXPECT: 72 72 105 */
auto device message1;

void show(const char* p) {
	print(p[0]);
}

const char* literal() {
	return "Hi";
}

void main() {
	const char* p;
	p = "Hi";
	show(p);

	char a[] = "hi";
	char* q = a;
	q[0] = 'H';
	print(q[0]);

	const char* r = literal();
	print(r[1]);

	printflush(message1);
	stop();
}
