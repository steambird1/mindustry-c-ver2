/*
Enum types in struct/union members and in function parameters.
A top-level enum keeps source order with structs; an enum defined inline in a
member list is registered before that member's type is resolved.
*/
/* EXPECT: 1 11 21 31 41 1 1 3 2 51 */
auto device message1;

enum Color { RED, GREEN, BLUE };

struct Tagged { enum Color c; };

enum Size { SMALL = 10, LARGE } globalSize;

struct WithVariable { enum Size s; };

struct Inline { enum Shape { CIRCLE = 20, SQUARE } shape; };

struct Anonymous { enum { FIRST = 30, SECOND } value; };

typedef enum { LOW = 40, HIGH } Level;
struct WithTypedef { Level level; };

union Box { enum Color c; int raw; };

int nextColor(enum Color c) { return c + 1; }
enum Color lastColor() { return BLUE; }

void main() {
	struct Tagged t;
	t.c = GREEN;
	print(t.c);

	struct WithVariable w;
	w.s = LARGE;
	print(w.s);

	struct Inline i;
	i.shape = SQUARE;
	print(i.shape);

	struct Anonymous a;
	a.value = SECOND;
	print(a.value);

	struct WithTypedef d;
	d.level = HIGH;
	print(d.level);

	union Box b;
	b.c = GREEN;
	print(b.c);
	print(b.raw);

	print(nextColor(BLUE));
	print(lastColor());

	struct Local { enum Kind { A = 50, B } kind; };
	struct Local l;
	l.kind = B;
	print(l.kind);

	printflush(message1);
	stop();
}
