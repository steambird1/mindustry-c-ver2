/*
Bitfields work in memory too. A struct that embeds an array is memory-backed,
and its bitfield storage cells still use the same mask/shift access.
*/
/* EXPECT: 7 3 2 3 9 */
auto device message1;

struct F {
	unsigned a : 3;
	unsigned b : 5;
	int pad[1];
};

struct F f;
struct F arr[2];

void main() {
	f.a = 15;
	f.b = 3;
	print(f.a);
	print(f.b);
	print(sizeof(f));

	arr[0].a = 3;
	arr[1].b = 9;
	print(arr[0].a);
	print(arr[1].b);

	printflush(message1);
	stop();
}
