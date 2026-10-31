/*
`static` is run-local in this dialect: one object shared by all calls during
one pass, reinitialized when the processor starts the program again.

`// RUNS: 2` asks the simulator to restart after `end()` while preserving
registers/memory. Both runs must print `2 1`:

- `test()` has a `static int w`; two call sites share it, so the first call
  increments 0 -> 1 (discarded) and the second prints 2;
- the file-scope `static int g` is zeroed/reinitialized each run, then prints
  1.

If the static local were duplicated by inlining, the second value would be 1.
*/
// RUNS: 2
/* EXPECT: 2 1 2 1 */
auto device message1;

static int g = 0;

int test() {
	static int w = 0;
	return ++w;
}

void main() {
	test();
	print(test());

	g = g + 1;
	print(g);

	printflush(message1);
	end();
}
