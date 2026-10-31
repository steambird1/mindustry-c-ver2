/*
Signed bitfields: the stored bits are sign-extended on read, while writes are
still masked to the declared width.
*/
/* EXPECT: -1 3 3 -4 -2 3 -1 2251799813685247 */
auto device message1;

struct F {
	signed a : 3;
	unsigned b : 5;
};

struct G {
	signed a : 3;
	unsigned b : 5;
	int pad[1];
};

struct H {
	signed a : 52;
};

void main() {
	struct F f;
	f.a = -1;
	f.b = 3;
	print(f.a);
	print(f.b);
	f.a = 3;
	print(f.a);
	f.a = -4;
	print(f.a);

	struct G g;
	g.a = -2;
	g.b = 3;
	print(g.a);
	print(g.b);

	struct H h;
	h.a = -1;
	print(h.a);
	h.a = 2251799813685247;
	print(h.a);

	printflush(message1);
	stop();
}
