/*
Arrays whose elements need more than one register are kept in memory
automatically. Both the automatic layout and an explicit
array("traditional", ...) request use the same element-wise storage.
*/
/* EXPECT: 3 4 3 7 8 */
struct P { int x; int y; };

struct P a[2] = {{1, 2}, {3, 4}};
int *p[2] = {&a[0].x, &a[1].x};
struct P b[2] = array("traditional", {{5, 6}, {7, 8}});

auto device message1;

void main() {
	print(a[1].x);
	print(a[1].y);
	print(*p[1]);
	print(b[1].x);
	print(b[1].y);
	printflush(message1);
	stop();
}
