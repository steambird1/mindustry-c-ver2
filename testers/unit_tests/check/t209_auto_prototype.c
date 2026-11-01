/*
An `auto` function can be prototyped too: the prototype joins the pattern
entry, and only its definition creates concrete versions.
*/
/* EXPECT: 1 2 */
auto device message1;

void show(auto int x);

void main() {
	show(1);
	show(2);

	printflush(message1);
	stop();
}

void show(auto int x) {
	print(x);
}
