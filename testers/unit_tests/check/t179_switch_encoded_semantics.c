/*
The encoded table must keep every switch semantic intact:

- `default` sits in the middle: a missing value enters there and falls
  through into the next case's statements;
- `case 0` falls into `default` and then into `case 1`;
- a switch inside a `while` uses `continue` (loop) and `break` (switch);
- a one-case switch nested in a case keeps the comparison chain.

Outputs: f(0) = 100 9 1, then the loop prints 3, then the nested switch
prints 200. f(9) enters default, falls into case 1, prints 9 1, the loop
prints 99 three times and the loop counter 3, and the last switch prints 299.
*/
/* EXPECT: 100 9 1 3 200 9 1 99 99 99 3 299 */
auto device message1;

#pragma noinline
void f(int x) {
	switch (x) {
		case 0: print(100);
		default: print(9);
		case 1: print(1); break;
		case 2: print(2); break;
		case 3: print(3); break;
		case 4: print(4); break;
		case 5: print(5); break;
		case 6: print(6); break;
		case 7: print(7); break;
	}

	int i = 0;
	while (i < 3) {
		switch (x) {
			case 0: i = i + 1; continue;
			case 1: print(10); break;
			case 2: print(20); break;
			case 3: print(30); break;
			case 4: print(40); break;
			case 5: print(50); break;
			case 6: print(60); break;
			case 7: print(70); break;
			default: print(99);
		}
		i = i + 1;
	}
	print(i);

	switch (x) {
		case 0: switch (x) { case 0: print(200); break; default: print(201); } break;
		case 1: print(210); break;
		case 2: print(220); break;
		case 3: print(230); break;
		case 4: print(240); break;
		case 5: print(250); break;
		case 6: print(260); break;
		case 7: print(270); break;
		default: print(299);
	}
}

void main() {
	f(0);
	f(9);
	printflush(message1);
	stop();
}
