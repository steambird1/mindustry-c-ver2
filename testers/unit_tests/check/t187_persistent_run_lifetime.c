/*
The same shape as t186, but with `persistent`: the object survives the
processor's restart, so the two runs print `2 1 0` and `4 2 1`.

The first call's value is discarded and the second prints 2; the next run
continues at 3/4. The file-scope `persistent int g` continues at 1 -> 2, and
the uninitialized `persistent int pg` is zero only once (0 -> 1).
*/
// RUNS: 2
/* EXPECT: 2 1 0 4 2 1 */
auto device message1;

persistent int g = 0;
persistent int pg;

int test() {
	persistent int w = 0;
	return ++w;
}

void main() {
	test();
	print(test());

	g = g + 1;
	print(g);

	print(pg);
	pg = pg + 1;

	printflush(message1);
	end();
}
