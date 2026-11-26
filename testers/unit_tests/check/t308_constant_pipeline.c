/*
A longer pipeline: a deterministic loop feeds a logical test, the logical
result selects a ternary branch, and a second loop accumulates the result.

    total = sum over i in 0..5 of (i even ? i + 1 : 10)   -> 39
    flag  = total > 30 && pure(total) == 40               -> 1
    pick  = flag ? total + 1 : -1                         -> 40
    out   = sum over k in 0..pick-1 of (k % 3)            -> 39

The first loop and both `for` loops are computed in full, so the generated
code prints `total` as the literal 39 and contains no `op lessThan`.
*/
/* EXPECT: 39 1 40 39 */
/* EMIT: print 39 */
/* EMIT-NOT: op lessThan */
auto device message1;

int pure(int x) { return x + 1; }

void main() {
	int total = 0;
	for (int i = 0; i < 6; i++) {
		if (i % 2 == 0) total += pure(i);
		else total += 10;
	}

	int flag = (total > 30) && (pure(total) == 40);
	int pick = flag ? total + 1 : -1;

	int out = 0;
	for (int k = 0; k < pick; k++) out += k % 3;

	print(total);
	print(flag);
	print(pick);
	print(out);

	printflush(message1);
	stop();
}
