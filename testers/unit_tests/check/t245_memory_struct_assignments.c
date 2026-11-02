/*
Assignment to a memory-layout struct-array element copies the struct
contents, not the block/pos reference. Covers a register struct value, a
compound literal, a bare initializer list, another element, the reverse
memory-to-register direction, and a dereferenced struct pointer.
*/
/* EXPECT: 1 2 3 4 5 6 3 4 5 6 9 10 */
struct S { int a; int b; };

struct S arr[3];
struct S globalSrc;
struct S globalDst;
struct S *globalPtr;

auto device message1;

void main() {
	struct S s;
	s.a = 1;
	s.b = 2;
	arr[0] = s;
	print(arr[0].a);
	print(arr[0].b);

	arr[1] = (struct S){3, 4};
	print(arr[1].a);
	print(arr[1].b);

	arr[2] = {5, 6};
	print(arr[2].a);
	print(arr[2].b);

	arr[0] = arr[1];
	print(arr[0].a);
	print(arr[0].b);

	struct S t;
	t = arr[2];
	print(t.a);
	print(t.b);

	globalSrc.a = 9;
	globalSrc.b = 10;
	globalPtr = &globalDst;
	*globalPtr = globalSrc;
	print(globalDst.a);
	print(globalDst.b);

	printflush(message1);
	stop();
}
