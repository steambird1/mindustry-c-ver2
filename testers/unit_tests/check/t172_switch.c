/*
`switch (x)` with C's semantics:

- `case 0:` falls through to `case 1:` (no implicit break);
- `break` leaves the switch;
- `default` keeps its SOURCE position, so a default in the middle falls
  through into the following case;
- two labels on one statement (`case 2: case 3:`) both reach it;
- `continue` inside a switch inside a `for` continues the LOOP, not the
  switch;
- nested switches keep their own `break` targets;
- `classify` is inlined at five call sites, so the switch survives a cloned
  body: the case values are ATTRIBUTES, like the character-literal raw, or
  the clone would compare against `undefined`.
*/
/* EXPECT: 11 10 1100 1000 -1 27 42 7 99 322 5 */
auto device message1;

int classify(int x) {
	int r = 0;
	switch (x) {
		case 0:
			r = r + 1;
		case 1:
			r = r + 10;
			break;
		case 2:
			r = r + 100;
		case 3:
			r = r + 1000;
			break;
		default:
			r = -1;
	}
	return r;
}

void main() {
	print(classify(0));
	print(classify(1));
	print(classify(2));
	print(classify(3));
	print(classify(9));

	int m = 0;
	switch (9) {
		case 1: m = 10; break;
		default: m = 20;
		case 2: m = m + 7; break;
	}
	print(m);

	switch (3) {
		case 1 + 2: print(42); break;
		default: print(-1);
	}

	switch ('A') {
		case 65: print(7); break;
		default: print(-1);
	}

	switch (2) {
		case 2:
		case 3:
			print(99);
			break;
	}

	int s = 0;
	for (int i = 0; i < 4; i++) {
		switch (i) {
			case 1: continue;
			case 2: s = s + 20; break;
			default: s = s + 1;
		}
		s = s + 100;
	}
	print(s);

	int r = 0;
	switch (1) {
		case 1:
			switch (2) {
				case 2: r = 5; break;
				default: r = 6;
			}
			break;
		default: r = 7;
	}
	print(r);

	printflush(message1);
	stop();
}
