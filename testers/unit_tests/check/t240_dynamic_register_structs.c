/*
Dynamic subscripts of multi-register struct elements: reads select each leaf
value; writes select each leaf register name and write through it; whole
element assignment copies member by member.
*/
/* EXPECT: 3 4 9 10 3 4 4 6 */
#pragma noinline
auto device message1;

struct P { int x; int y; };
struct Q { struct P p; int z; };

struct P a[2] = array("embedded_divided", {{1, 2}, {3, 4}});
struct Q q[2] = array("embedded_divided", {{{1, 2}, 3}, {{4, 5}, 6}});

void readAt(int i) {
	print(a[i].x);
	print(a[i].y);
}

void writeAt(int i) {
	a[i].x = 9;
	a[i].y = 10;
	print(a[i].x);
	print(a[i].y);
}

void copyAt(int i, int j) {
	a[i] = a[j];
	print(a[i].x);
	print(a[i].y);
}

void readNested(int i) {
	print(q[i].p.x);
	print(q[i].z);
}

void main() {
	readAt(1);
	writeAt(0);
	copyAt(0, 1);
	readNested(1);
	printflush(message1);
	stop();
}
