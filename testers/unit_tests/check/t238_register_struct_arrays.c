/*
Coordinate-like registry structs can live in a register array. Constant-index
elements support member reads/writes, whole-element assignment, nested flat
structs and zero-filled omitted members.
*/
/* EXPECT: 3 4 9 3 4 7 0 5 6 7 2 4 */
struct P { int x; int y; };
struct Q { struct P p; int z; };

struct P a[2] = array("embedded_divided", {{1, 2}, {3, 4}});
struct P missing[1] = array("embedded_divided", {{7}});
struct Q nested[1] = array("embedded_divided", {{{5, 6}, 7}});

auto device message1;

void main() {
	print(a[1].x);
	print(a[1].y);

	a[0].x = 9;
	print(a[0].x);

	a[0] = a[1];
	print(a[0].x);
	print(a[0].y);

	print(missing[0].x);
	print(missing[0].y);

	print(nested[0].p.x);
	print(nested[0].p.y);
	print(nested[0].z);

	print(lenof(a));
	print(sizeof(a));
	printflush(message1);
	stop();
}
