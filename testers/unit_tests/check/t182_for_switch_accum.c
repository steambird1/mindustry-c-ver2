/*
`for (int i = ...)` puts `i` in a synthesized `forinit` scope, while `sum`
lives in the enclosing block. Both must be seeded into their OWN constant
tables before the switch body is analysed as unsure, or the accumulator stays
unknown and the loop cannot fold.

- fallthrough switch: 150;
- the same switch with `break`: 65.

`EMIT-NOT: op lessThan` proves both loops are gone; the printed values are
constants.
*/
/* EXPECT: 150 65 */
/* EMIT: print 150 */
/* EMIT: print 65 */
/* EMIT-NOT: op lessThan */
auto device message1;

void main() {
	int sum = 0;
	for (int i = 0; i < 5; i++) {
		switch (i) {
			case 0: sum += 10;
			case 1: sum += 20;
			case 4: sum += 30;
			default: sum += i;
		}
	}
	print(sum);

	int sum2 = 0;
	for (int j = 0; j < 5; j++) {
		switch (j) {
			case 0: sum2 += 10; break;
			case 1: sum2 += 20; break;
			case 4: sum2 += 30; break;
			default: sum2 += j; break;
		}
	}
	print(sum2);

	printflush(message1);
	stop();
}
