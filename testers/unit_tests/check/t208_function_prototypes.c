/*
Function prototypes: a declaration before the definition lets a caller appear
first; a redundant prototype after the definition is accepted; overload
prototypes and a prototype that is never called are allowed.
*/
/* EXPECT: 3 4 1 2 */
auto device message1;

int add(int x);

int twice(int x) { return x * 2; }
int twice(int);

int pick(int x);
int pick(float x);

int unused(int x);

void main() {
	print(add(1));
	print(twice(2));
	print(pick(1));
	print(pick(2.5));

	printflush(message1);
	stop();
}

int add(int x) { return x + 2; }
int pick(int x) { return 1; }
int pick(float x) { return 2; }
