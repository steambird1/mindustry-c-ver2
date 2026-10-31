/*
C enums: enumerators are int constants in the surrounding scope, auto-increment
after an explicit value, and can be used in array sizes and switch labels.
*/
/* EXPECT: 0 5 6 3 6 13 6 3 7 */
auto device message1;

enum Color { RED, GREEN = 5, BLUE };
typedef enum { A = 1 + 2, B = A * 2, C = (B << 1) | 1 } E;
enum { N = 3 };

void main() {
	print(RED);
	print(GREEN);
	print(BLUE);

	print(A);
	print(B);
	print(C);

	enum Color c = BLUE;
	print(c);

	int a[N] = {1, 2, 3};
	print(a[2]);

	int r = 0;
	switch (c) {
		case BLUE: r = 7; break;
		default: r = 8;
	}
	print(r);

	printflush(message1);
	stop();
}
