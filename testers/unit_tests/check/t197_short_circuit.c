/*
C evaluation order: the right side of `&&` / `||` and the unselected branch of
`?:` must not be evaluated. Calls are kept at the conditional site instead of
being inlined/hoisted out of it.
*/
/* EXPECT: 0 0 1 1 1 1 2 0 3 0 */
auto device message1;

int n = 0;
int yes() { n = n + 1; return 1; }
int no()  { n = n + 1; return 0; }

void main() {
	int a = @tick < 0;   // runtime false
	int b = @tick >= 0;  // runtime true

	int x = a && yes();
	print(n);
	print(x);

	int y = b && yes();
	print(n);
	print(y);

	int z = b || no();
	print(n);
	print(z);

	int w = a || no();
	print(n);
	print(w);

	int q = a ? yes() : no();
	print(n);
	print(q);

	printflush(message1);
	stop();
}
