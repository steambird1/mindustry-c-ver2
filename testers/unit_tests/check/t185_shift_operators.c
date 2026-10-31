/*
Shift operators: `<<` / `>>` and their compound assignments.

The parser now has C's shift precedence level (between additive and
relational), and the lexer recognizes three-character `<<=` / `>>=` before
`<<` / `>>`.

- runtime shifts through `#pragma noinline` functions: 8, 4;
- `1 << 2 + 1` = 1 << 3 = 8; `1 + 1 << 2` = 2 << 2 = 8;
- relational precedence: `(1 << 2) < 5` is true (printed as 1);
- left-associative `64 >> 1 >> 1` = 16;
- `x <<= 3`, `y >>= 2`, unsigned `u >>= 4`, and a variable shift count;
- a shift in a `case` label: `case 1 << 3` matches 8.
*/
/* EXPECT: 8 4 8 8 1 16 8 4 15 12 7 */
/* EMIT: op shl */
/* EMIT: op shr */
auto device message1;

#pragma noinline
int shl(int x, int n) { return x << n; }

#pragma noinline
int shr(int x, int n) { return x >> n; }

void main() {
	print(shl(1, 3));
	print(shr(16, 2));

	print(1 << 2 + 1);
	print(1 + 1 << 2);
	int cmp = (1 << 2) < 5;
	print(cmp);
	print(64 >> 1 >> 1);

	int x = 1;
	x <<= 3;
	print(x);

	int y = 16;
	y >>= 2;
	print(y);

	unsigned u = 240;
	u >>= 4;
	print(u);

	int shift = 2;
	int z = 3;
	z <<= shift;
	print(z);

	int v = 0;
	switch (8) {
		case 1 << 3: v = 7; break;
		default: v = 9;
	}
	print(v);

	printflush(message1);
	stop();
}
