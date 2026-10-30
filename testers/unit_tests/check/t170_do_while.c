/*
`do body while (test);` runs the body FIRST, then tests. That is the whole
difference from `while`, and every case below depends on it:

- `while (false)` would skip the body; the first loop runs it once;
- `continue` jumps to the TEST, not to the body, so the `j == 2` round still
  advances `j` and the condition can end the loop;
- `break` leaves immediately;
- a do-while nested inside another runs its body once per outer round.

The optimizer treats a do-while conservatively (it does not unroll it yet),
so this case pins the SEMANTICS under every pragma variant; the code shape is
`check/t`'s business only where an EMIT says so.
*/
/* EXPECT: 1 3 3 4 2 4 */
auto device message1;

void main() {
	int once = 0;
	do { once = once + 1; } while (false);
	print(once);

	int i = 0;
	do { i = i + 1; } while (i < 3);
	print(i);

	int j = 0, s = 0;
	do {
		j = j + 1;
		if (j == 2) continue;
		s = s + j;
	} while (j < 3);
	print(j);
	print(s);

	int k = 0;
	do { k = k + 1; if (k == 2) break; } while (k < 5);
	print(k);

	int n = 0, a = 0;
	do {
		int b = 0;
		do { b = b + 1; n = n + 1; } while (b < 2);
		a = a + 1;
	} while (a < 2);
	print(n);

	printflush(message1);
	stop();
}
