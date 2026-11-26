/*
Folding `&&` / `||` must keep every side effect C would perform:

    0 && (x = 7)   the right side never runs, x keeps its value
    1 || (x = 11)  same, short-circuited
    1 && (x = 5)   the right side runs, x becomes 5
    0 || (x = 9)   same
    (x = 13) && 0  the LEFT side always runs, x becomes 13

The last two are the important ones: the assignment is on the left of the
short-circuit, so it must survive even when the whole expression folds to 0/1.
*/
/* EXPECT: 5 1 5 0 9 1 9 1 13 0 15 1 */
auto device message1;

void main() {
	int x = 0;

	int a = 1 && (x = 5);
	print(x); print(a);

	int b = 0 && (x = 7);
	print(x); print(b);

	int c = 0 || (x = 9);
	print(x); print(c);

	int d = 1 || (x = 11);
	print(x); print(d);

	int e = (x = 13) && 0;
	print(x); print(e);

	int f = (x = 15) || 1;
	print(x); print(f);

	printflush(message1);
	stop();
}
