/*
More `for (int i = ...)` shapes where the loop body uses `i`. The loop
variable's `forinit` scope and the accumulator's outer scope must both be
seeded; otherwise these loops stop folding.

- plain accumulation: 10;
- early `break`: 3;
- step 2: 20;
- `i != 5` test: 10.

All four loops fold, so no `lessThan` remains.
*/
/* EXPECT: 10 3 20 10 */
/* EMIT: print 10 */
/* EMIT: print 3 */
/* EMIT: print 20 */
/* EMIT-NOT: op lessThan */
auto device message1;

void main() {
	int a = 0;
	for (int i = 0; i < 5; i++) { a += i; }
	print(a);

	int b = 0;
	for (int i = 0; i < 10; i++) { if (i == 3) break; b += i; }
	print(b);

	int c = 0;
	for (int i = 0; i < 10; i += 2) { c += i; }
	print(c);

	int d = 0;
	for (int i = 0; i != 5; i++) { d += i; }
	print(d);

	printflush(message1);
	stop();
}
