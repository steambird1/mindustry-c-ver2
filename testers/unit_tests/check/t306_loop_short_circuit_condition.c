/*
Compile-time loop evaluation is not limited to `identifier op constant`. The
simulator evaluates the whole test each round, so a short-circuit condition
folds the loop the same way a simple one does:

    while (i < 5 && sum < 100)   // both sides decide
    while (!(i >= 5))            // negated comparison
    while (i < 3 || u == 99)     // `||` whose right side is false

`EMIT-NOT: op lessThan` is the assertion: a loop left to run at runtime keeps
its comparison. (`lessThanEq` belongs to the stack machinery and is allowed.)
*/
/* EXPECT: 10 5 10 5 3 3 */
/* EMIT-NOT: op lessThan */
auto device message1;

void main() {
	int i = 0, sum = 0;
	while (i < 5 && sum < 100) { sum += i; i++; }
	print(sum);
	print(i);

	int j = 0, t = 0;
	while (!(j >= 5)) { t += j; j++; }
	print(t);
	print(j);

	int k = 0, u = 0;
	while (k < 3 || u == 99) { u += k; k++; }
	print(u);
	print(k);

	printflush(message1);
	stop();
}
