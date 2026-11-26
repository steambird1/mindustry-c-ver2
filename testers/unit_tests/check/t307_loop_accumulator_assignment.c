/*
`sum = sum + i` must fold exactly like `sum += i`. The simulator seeds every
variable the loop writes with its pre-loop value; otherwise the accumulator
looks unknown on the first round and the loop cannot be computed in full.

All three loop forms are covered. `EMIT-NOT: op lessThan` says none of them
was left as a runtime loop.
*/
/* EXPECT: 10 5 10 10 5 */
/* EMIT-NOT: op lessThan */
auto device message1;

void main() {
	int i = 0, sum = 0;
	while (i < 5) { sum = sum + i; i = i + 1; }
	print(sum);
	print(i);

	int s2 = 0;
	for (int j = 0; j < 5; j++) { s2 = s2 + j; }
	print(s2);

	int d = 0, s3 = 0;
	do { s3 = s3 + d; d = d + 1; } while (d < 5);
	print(s3);
	print(d);

	printflush(message1);
	stop();
}
