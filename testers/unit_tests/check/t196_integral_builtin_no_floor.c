/*
A3: `abs`/`min`/`max` over integer arguments already produce an integer, so
assigning them to `int` must not add a redundant `op floor`.
*/
/* EXPECT: 4 3 7 */
/* EMIT-NOT: op floor/ */
auto device message1;

void main() {
	int a = 3;
	int b = 7;

	int r = abs(a - b);
	int lo = min(a, b);
	int hi = max(a, b);

	print(r);
	print(lo);
	print(hi);
	printflush(message1);
	stop();
}
