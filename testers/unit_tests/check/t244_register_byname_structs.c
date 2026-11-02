/*
A `byname` pointer member is one register holding a target name. Register
struct arrays support initialization (including extra braces around the
scalar), constant and dynamic dereference/assignment, whole-element assignment
and nested structs.
*/
/* EXPECT: 7 1 7 3 4 8 2 8 8 2 7 3 4 8 */
#pragma noinline
auto device message1;

int x = 7;
int y = 8;

struct Ptr { int *byname p; int n; };
struct NestedPtr { struct Ptr inner; int z; };

struct Ptr a[2] = array("embedded_divided",
	{{{byname(&x)}, 1}, {byname(&y), 2}});
struct NestedPtr b[1] = array("embedded_divided",
	{{{byname(&x), 3}, 4}});

void readAt(int i) {
	print(*a[i].p);
	print(a[i].n);
}

void writeAt(int i) {
	a[i].p = byname(&y);
	print(*a[i].p);
}

void copyAt(int i, int j) {
	a[i] = a[j];
	print(*a[i].p);
	print(a[i].n);
}

void readNested(int i) {
	print(*b[i].inner.p);
	print(b[i].inner.n);
	print(b[i].z);
}

void writeNested(int i) {
	b[i].inner.p = byname(&y);
	print(*b[i].inner.p);
}

void main() {
	print(*a[0].p);
	print(a[0].n);

	print(*b[0].inner.p);
	print(b[0].inner.n);
	print(b[0].z);

	readAt(1);
	writeAt(0);
	copyAt(0, 1);
	readNested(0);
	writeNested(0);

	printflush(message1);
	stop();
}
