/*
C typedef struct forms: anonymous and tagged definitions, a self-referential
node, a nested typedef, and a pointer alias.
*/
/* EXPECT: 3 1 2 7 1 2 */
auto device message1;

typedef struct { int x; int y; } Pair;
typedef struct Node { int v; struct Node *next; } Node;
typedef struct { Pair in; int z; } Outer;
typedef Pair *PairPtr;

void main() {
	Pair p;
	p.x = 1;
	p.y = 2;
	print(p.x + p.y);

	Node a;
	Node b;
	a.v = 1;
	b.v = 2;
	a.next = &b;
	print(a.v);
	print(a.next->v);

	Outer o = {{3, 4}, 5};
	print(o.in.x + o.in.y + o.z - 5);

	PairPtr q = &p;
	print(q->x);

	print(sizeof(Pair));

	printflush(message1);
	stop();
}
