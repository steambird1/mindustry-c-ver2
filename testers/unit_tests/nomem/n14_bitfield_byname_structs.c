/*
Without any memory block, bitfield and byname-pointer struct arrays use the
register layout automatically.
*/
/* EXPECT: 3 5 7 9 */
auto device message1;

int x = 7;

struct Bits { int a:3; int b:4; };
struct Ptr { int *byname p; int n; };

struct Bits bits[1] = {{3, 5}};
struct Ptr ptrs[1] = {{byname(&x), 9}};

void main() {
	print(bits[0].a);
	print(bits[0].b);
	print(*ptrs[0].p);
	print(ptrs[0].n);
	printflush(message1);
	stop();
}
