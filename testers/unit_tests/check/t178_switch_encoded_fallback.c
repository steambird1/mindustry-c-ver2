/*
The encoded jump table stores one character per value in the case RANGE. A
sparse switch (0..6 and 100000) would need a huge string, so the generator
keeps the comparison chain instead. The output must be unchanged.

The `EMIT-NOT` assertion proves the table was not used.
*/
/* EXPECT: 10 17 99 */
/* EMIT-NOT: read __switch_tgt_ */
auto device message1;

#pragma noinline
void classify(int x) {
	switch (x) {
		case 0: print(10); break;
		case 1: print(11); break;
		case 2: print(12); break;
		case 3: print(13); break;
		case 4: print(14); break;
		case 5: print(15); break;
		case 6: print(16); break;
		case 100000: print(17); break;
		default: print(99);
	}
}

void main() {
	classify(0);
	classify(100000);
	classify(9);
	printflush(message1);
	stop();
}
