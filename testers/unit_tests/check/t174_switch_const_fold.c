/*
When the discriminant is a compile-time constant, the switch is replaced by
the path it takes; the loop optimizers then see straight-line code.

- `switch (2)` becomes `r = 5;`, so `print(r)` folds to `print 5`;
- `while (i < 3) { switch (0) { case 0: i = i + 1; ... } }` becomes the plain
  `while (i < 3) i = i + 1;`, which the deterministic optimizer folds to
  `print 3`.

`EMIT-NOT: op lessThan` proves both loops are gone; the two `print` lines are
the constants, not the variables. The runner re-runs this under the
invariance pragmas.
*/
/* EXPECT: 5 3 */
/* EMIT: print 5 */
/* EMIT: print 3 */
/* EMIT-NOT: op lessThan */
auto device message1;

void main() {
	int r = 0;
	switch (2) {
		case 2: r = 5; break;
		default: r = 9;
	}
	print(r);

	int i = 0;
	while (i < 3) {
		switch (0) {
			case 0: i = i + 1; break;
			default: i = i + 99;
		}
	}
	print(i);

	printflush(message1);
	stop();
}
