/*
Forcing the encoded table lets a small, sparse switch use it too:
three cases with a range of 21 are rejected by the automatic heuristic
(case count and density), but `#pragma optimize(switch_table, 32)` allows
up to 32 values. The output must be identical to the chain.

The `EMIT` assertion proves the forced table is present.
*/
/* EXPECT: 10 11 12 99 */
/* EMIT: read __switch_tgt_ */
#pragma optimize(switch_table, 32)
auto device message1;

#pragma noinline
void classify(int x) {
	switch (x) {
		case 0: print(10); break;
		case 1: print(11); break;
		case 20: print(12); break;
		default: print(99);
	}
}

void main() {
	classify(0);
	classify(1);
	classify(20);
	classify(5);
	printflush(message1);
	stop();
}
