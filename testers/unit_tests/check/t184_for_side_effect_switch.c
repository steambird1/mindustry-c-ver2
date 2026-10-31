/*
`for (int i = ...)` loops that must NOT be fully folded still have to keep
their side effects:

- `continue` skips one iteration: 8;
- a switch whose cases print: 10 20 0 20 1 2;
- a switch that both accumulates and prints: 100 200 300, then sum 6;
- a switch whose `break` is conditional: the loop stays conservative and
  prints 3.

The last two are the cases that used to be deleted because
`hasSideEffects(SwitchStatement)` looked at no statements. The accumulated
`sum` stays live and the switch is not mistaken for straight-line code.
*/
/* EXPECT: 8 10 20 0 20 1 2 100 200 300 6 3 */
auto device message1;

void main() {
	int e = 0;
	for (int i = 0; i < 5; i++) {
		if (i == 2) continue;
		e += i;
	}
	print(e);

	for (int i = 0; i < 3; i++) {
		switch (i) {
			case 0: print(10);
			case 1: print(20);
			default: print(i);
		}
	}

	int sum = 0;
	for (int i = 0; i < 3; i++) {
		switch (i) {
			case 0: sum += 1; print(100); break;
			case 1: sum += 2; print(200); break;
			default: sum += 3; print(300);
		}
	}
	print(sum);

	int g = 0;
	for (int i = 0; i < 3; i++) {
		switch (i) {
			case 1:
				if (i == 1) { g += 1; break; }
				break;
			default: g += i;
		}
	}
	print(g);

	printflush(message1);
	stop();
}
