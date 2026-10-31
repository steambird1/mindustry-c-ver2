/*
`#pragma optimize(switch_table, off)` must keep the comparison chain even
for a dense switch that the heuristic would otherwise turn into a table.
The output is unchanged.

`EMIT-NOT: read __switch_tgt_` proves the table was disabled.
*/
/* EXPECT: 10 13 17 99 */
/* EMIT-NOT: read __switch_tgt_ */
#pragma optimize(switch_table, off)
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
		case 7: print(17); break;
		default: print(99);
	}
}

void main() {
	classify(0);
	classify(3);
	classify(7);
	classify(9);
	printflush(message1);
	stop();
}
