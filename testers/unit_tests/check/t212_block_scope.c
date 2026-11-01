/*
Block-scope prototypes, local struct definitions, local typedefs, local enums
and tag/typedef shadowing. A block-scope prototype may name a later global
definition; the local declaration disappears after semantic analysis.
*/
/* EXPECT: 4 2.5 2 3 5 7 */
auto device message1;

struct P { int x; };
typedef int I;

void main() {
	int f(int);

	{
		struct P { int y; };
		struct P p;
		p.y = 4;
		print(p.y);

		typedef float I;
		I q = 2.5;
		print(q);

		print(f(1));
	}

	struct P g;
	g.x = 3;
	print(g.x);

	I y = 5;
	print(y);

	enum E { A = 7 };
	print(A);

	printflush(message1);
	stop();
}

int f(int x) { return x + 1; }
