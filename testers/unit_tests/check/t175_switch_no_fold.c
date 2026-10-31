/*
The constant fold is deliberately conservative; these shapes keep the switch
and must still produce the right answer:

- a `break` inside an `if` belongs to the switch and cannot be removed
  without a goto;
- a declaration at the switch's FLAT level keeps the switch (the jump would
  skip its initializer);
- a declaration inside a case BLOCK is safe, and that switch does fold;
- the same conditional break inside a LOOP keeps the loop, and the loop
  must still run (an earlier pass folded `q = q + 1` to `q = 1`, which
  never ended).

No `EMIT` here: the point is the OUTPUT, so a future transform that safely
folds the first two shapes is free to do so.
*/
/* EXPECT: 1 5 7 3 */
auto device message1;

void main() {
	int x = 1;
	int r = 0;
	switch (1) {
		case 1:
			if (x) { r = 1; break; }
			r = 99;
			break;
		default: r = -1;
	}
	print(r);

	switch (1) {
		int t = 7;
		case 1: print(5); break;
	}

	switch (1) {
		case 1: {
			int u = 7;
			print(u);
		}
		break;
		default: print(-1);
	}

	int q = 0;
	while (q < 3) {
		switch (q) {
			case 1:
				if (q == 1) { q = q + 1; break; }
				break;
			default: q = q + 1;
		}
	}
	print(q);

	printflush(message1);
	stop();
}
