/*
A switch whose discriminant is only known per round used to keep its loop
out of the deterministic optimizer. The simulator now picks the taken case
for each round (fallthrough included), so these loops fold to constants:

- `switch (i)` where every case steps `i` alike -> `print 3`;
- a non-uniform step (default `i += 2`) still stops on the test -> `print 3`;
- a second loop-written variable (`n`) is simulated too, with fallthrough
  from `case 0` into `case 1` -> `print 4` / `print 221`.

`EMIT-NOT: op lessThan` proves every loop is gone; each `print` is a
constant, not a variable. The runner re-runs this under the invariance
pragmas.
*/
/* EXPECT: 3 3 4 221 */
/* EMIT: print 3 */
/* EMIT: print 4 */
/* EMIT: print 221 */
/* EMIT-NOT: op lessThan */
auto device message1;

void main() {
	int i = 0;
	while (i < 3) {
		switch (i) {
			case 0: i = i + 1; break;
			default: i = i + 1;
		}
	}
	print(i);

	int j = 0;
	while (j < 3) {
		switch (j) {
			case 0: j = j + 1; break;
			default: j = j + 2;
		}
	}
	print(j);

	int k = 0;
	int n = 0;
	while (k < 4) {
		switch (k) {
			case 0: n = n + 1;
			case 1: n = n + 10; break;
			default: n = n + 100;
		}
		k = k + 1;
	}
	print(k);
	print(n);

	printflush(message1);
	stop();
}
