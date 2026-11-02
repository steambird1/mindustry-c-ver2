/*
C99 designated initializers for structs and arrays. Unspecified members are
zero-filled; existing positional lists keep their old meaning.
*/
/* EXPECT: 0 2 7 0 0 0 0 0 5 3 4 */
struct P { int x; int y; };

struct P gp = { .y = 2 };
int ga[4] = { [1] = 3, [3] = 4 };

auto device message1;

void main() {
	print(gp.x);
	print(gp.y);

	int a[5] = { [2] = 7 };
	print(a[2]);
	print(a[0]);
	print(a[1]);
	print(a[3]);
	print(a[4]);

	struct P p = { .y = 5 };
	print(p.x);
	print(p.y);

	struct P q = { .x = 3, .y = 4 };
	print(q.x);
	print(q.y);

	printflush(message1);
	stop();
}
