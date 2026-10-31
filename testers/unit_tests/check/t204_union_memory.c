/*
A multi-member union is memory-backed: all members start at offset 0 and the
union has the size of its largest member. A single-member union may stay in a
register.
*/
/* EXPECT: 7 7 0 2 4 1 */
auto device message1;

struct P { int x; int y; };
union U { struct P p; int a; };
union One { int a; };

union U u;
union One one;

void main() {
	u.a = 7;
	print(u.a);
	print(u.p.x);
	print(u.p.y);
	print(sizeof(u));

	union U v;
	v.p.x = 3;
	v.p.y = 4;
	print(v.p.y);

	one.a = 9;
	print(sizeof(one));

	printflush(message1);
	stop();
}
