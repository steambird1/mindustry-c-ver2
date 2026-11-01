/*
Struct/union forward declarations: an incomplete tag can be used through a
pointer; a later definition fills the SAME type object, so mutual references
and typedef aliases created before completion keep working.
*/
/* EXPECT: 1 2 1 5 3 1 */
auto device message1;

struct A;
struct B;
struct B { struct A *a; int y; };
struct A { struct B *b; int x; };

typedef struct Q Q;
struct Q { int v; };

void main() {
	struct A a;
	struct B b;
	a.x = 1;
	b.y = 2;
	a.b = &b;
	b.a = &a;
	print(a.x);
	print(a.b->y);
	print(b.a->x);

	Q q;
	q.v = 5;
	print(q.v);
	print(sizeof(struct A));
	print(sizeof(Q));

	printflush(message1);
	stop();
}
