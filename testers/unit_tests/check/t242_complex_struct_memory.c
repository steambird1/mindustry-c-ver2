/*
Struct arrays whose elements are not register-compatible fall back to memory
automatically. This covers array, union and ordinary-pointer members, a
`byname` pointer member (its memory form is the target name) and bitfield
members (several fields share one storage cell).
*/
/* EXPECT: 4 5 6 7 8 7 9 11 12 3 5 1 2 */
struct WithArray { int v[2]; int x; };
union U { int i; int f; };
struct WithUnion { union U u; int x; };
struct WithPointer { int *p; int n; };
struct WithByname { int *byname p; int n; };
struct Bits { int a:3; int b:4; };

int x = 7;
int y = 11;

struct WithArray wa[1] = {{{4, 5}, 6}};
struct WithUnion wu[1] = {{{7}, 8}};
struct WithPointer wp[1] = {{&x, 9}};
struct WithByname wb[1] = array("traditional", {{byname(&y), 12}});
struct Bits bits[2] = array("traditional", {{3, 5}, {1, 2}});

auto device message1;

void main() {
	print(wa[0].v[0]);
	print(wa[0].v[1]);
	print(wa[0].x);

	print(wu[0].u.i);
	print(wu[0].x);

	print(*wp[0].p);
	print(wp[0].n);

	print(*wb[0].p);
	print(wb[0].n);

	print(bits[0].a);
	print(bits[0].b);
	print(bits[1].a);
	print(bits[1].b);

	printflush(message1);
	stop();
}
