/*
The four nesting directions around `switch`, all in one file:

- a `do-while` whose body is a switch: in one loop the switch advances the
  loop variable itself, in the other it only updates a side-effect counter;
- a switch whose cases contain a `for`, a `while` and a `do-while`;
- `while` -> `switch` -> `for`.

A loop containing a switch is kept OUT of the deterministic loop
optimizations (a switch has its own `break` targets and a dispatch the loop
simulator does not model). The outputs must not depend on that choice; the
runner re-runs this under `#pragma noinline` and the other invariance pragmas.
*/
/* EXPECT: 3 21 3 3 3 103 */
auto device message1;

void main() {
	int i = 0;
	do {
		switch (i) {
			case 0: i = i + 1; break;
			case 1: i = i + 2; break;
			default: i = i + 3;
		}
	} while (i < 3);
	print(i);

	int j = 0, n = 0;
	do {
		switch (j) {
			case 0: n = n + 1; break;
			default: n = n + 10;
		}
		j = j + 1;
	} while (j < 3);
	print(n);

	switch (1) {
		case 1: {
			int s = 0;
			for (int k = 0; k < 3; k++) s = s + k;
			print(s);
			break;
		}
		default: print(-1);
	}

	switch (1) {
		case 1: {
			int w = 0;
			while (w < 3) w = w + 1;
			print(w);
			break;
		}
		default: print(-1);
	}

	switch (1) {
		case 1: {
			int d = 0;
			do { d = d + 1; } while (d < 3);
			print(d);
			break;
		}
		default: print(-1);
	}

	int t = 0;
	int q = 0;
	while (q < 2) {
		switch (q) {
			case 0: {
				int u = 0;
				for (int z = 0; z < 3; z++) u = u + z;
				t = t + u;
				break;
			}
			default: t = t + 100;
		}
		q = q + 1;
	}
	print(t);

	printflush(message1);
	stop();
}
