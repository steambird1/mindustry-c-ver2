/*
A `?:` whose test is a short-circuit expression used to crash the code
generator: the v152+ `select` fast path fed an instruction GROUP (branches
plus a temporary) where a comparison was expected.

The chosen branch must also keep its side effects -- `(a < b) ? (a = 7) : 9`
assigns 7 to `a`, because the branch expression replaces the conditional, not
just its value.
*/
/* EXPECT: 42 42 0 7 7 */
auto device message1;

int pure(int x) { return x * 2 + 1; }

void main() {
	int a = 2, b = 3;

	int x = (a < b && pure(a) == 5) ? 42 : 0;
	int y = (a > b || pure(a) == 5) ? 42 : 0;
	int z = (a > b) ? 42 : 0;
	int w = (a < b) ? (a = 7) : 9;

	print(x);
	print(y);
	print(z);
	print(w);
	print(a);

	printflush(message1);
	stop();
}
