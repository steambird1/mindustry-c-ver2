/*
Two loops with the same known trip count, one `while` and one `do-while`.
Both are fully replaced by their final value; the do-while is a comparison,
not a special case:

    while (w < 3) { w = w + 1; }      // printed: 3
    do { d = d + 1; } while (d < 3);  // printed: 3

`EMIT-NOT: op lessThan` is the point: a loop that was NOT optimized would
leave the comparison instruction behind. (`lessThanEq` belongs to the stack
machinery and is not what this forbids.) The do-while path reuses the while
model only when the ENTRY test is true; when it is false the body still runs
once, and `t170` pins that semantic difference.

The runner re-runs this under `#pragma noinline` and the other invariance
pragmas.
*/
/* EXPECT: 3 3 */
/* EMIT: print 3 */
/* EMIT-NOT: op lessThan */
auto device message1;

void main() {
	int w = 0;
	while (w < 3) { w = w + 1; }

	int d = 0;
	do { d = d + 1; } while (d < 3);

	print(w);
	print(d);
	printflush(message1);
	stop();
}
