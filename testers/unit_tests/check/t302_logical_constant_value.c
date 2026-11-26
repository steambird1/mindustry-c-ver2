/*
C's `&&` / `||` produce 0 or 1, never the operand's own value. The optimizer
must fold them to the same result the runtime comparison produces:
`1 && 5` is 1, not 5; `0 || 5` is 1, not 5.

The second half checks the same rule when the operand is only known at
runtime (`@tick`), so a folding bug cannot hide behind the constant table.
*/
/* EXPECT: 1 1 1 1 0 0 0 1 1 1 1 0 */
auto device message1;

void main() {
	print(1 && 5);
	print(0 || 5);
	print(2 && 3);
	print(1 || 3);
	print(0 && 7);
	print(0 || 0);
	print(7 && 0);
	print(0 || 9);

	int yes = @tick >= 0;
	int no = @tick < 0;
	print(yes && 5);
	print(no || 5);
	print(yes || 3);
	print(no && 3);

	printflush(message1);
	stop();
}
