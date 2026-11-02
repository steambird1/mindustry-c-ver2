/*
Bitfield members can live in register-struct arrays. A bitfield storage cell
is one register; several visible fields share it. This covers initialization,
constant and dynamic member access, whole-element assignment, mixed
bitfield/non-bitfield members and nested structs.
*/
/* EXPECT: 3 5 7 3 8 5 3 5 9 1 2 6 9 1 2 3 5 9 6 */
#pragma noinline
auto device message1;

struct Bits { int a:3; int b:4; };
struct Mixed { int x; int a:3; int y; int b:4; };
struct Nested { struct Bits bits; int z; };

struct Bits bits[2] = array("embedded_divided", {{3, 5}, {1, 2}});
struct Mixed mixed[1] = array("embedded_divided", {{7, 3, 8, 5}});
struct Nested nested[1] = array("embedded_divided", {{{3, 5}, 9}});

void readAt(int i) {
	print(bits[i].a);
	print(bits[i].b);
}

void writeAt(int i) {
	bits[i].a = 6;
	bits[i].b = 9;
	print(bits[i].a);
	print(bits[i].b);
}

void copyAt(int i, int j) {
	bits[i] = bits[j];
	print(bits[i].a);
	print(bits[i].b);
}

void readNested(int i) {
	print(nested[i].bits.a);
	print(nested[i].bits.b);
	print(nested[i].z);
}

void writeNested(int i) {
	nested[i].bits.b = 6;
	print(nested[i].bits.b);
}

void main() {
	print(bits[0].a);
	print(bits[0].b);

	print(mixed[0].x);
	print(mixed[0].a);
	print(mixed[0].y);
	print(mixed[0].b);

	print(nested[0].bits.a);
	print(nested[0].bits.b);
	print(nested[0].z);

	readAt(1);
	writeAt(0);
	copyAt(0, 1);
	readNested(0);
	writeNested(0);

	printflush(message1);
	stop();
}
