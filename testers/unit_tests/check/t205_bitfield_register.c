/*
Unsigned bitfields are packed LSB-first into one register cell. Values are
masked to their width; more than 52 bits starts another cell.
*/
/* EXPECT: 7 3 1 0 5 4095 1234 2345 3456 67108863 33554431 1 7 3 2 3 134217727 1 2 */
auto device message1;

struct F {
	unsigned a : 3;
	unsigned b : 5;
};

struct W {
	unsigned a : 12;
	unsigned b : 12;
	unsigned c : 12;
	unsigned d : 12;
};

struct Q {
	unsigned a : 26;
	unsigned b : 26;
};

struct Mixed {
	int x;
	unsigned a : 3;
	unsigned b : 5;
	int y;
};

struct Split {
	unsigned a : 27;
	unsigned b : 27;
};

void main() {
	struct F f;
	f.a = 15;
	f.b = 3;
	print(f.a);
	print(f.b);
	print(sizeof(f));

	f.a++;
	f.b += 2;
	print(f.a);
	print(f.b);

	struct W w;
	w.a = 4095;
	w.b = 1234;
	w.c = 2345;
	w.d = 3456;
	print(w.a);
	print(w.b);
	print(w.c);
	print(w.d);

	struct Q q;
	q.a = 67108863;
	q.b = 33554431;
	print(q.a);
	print(q.b);

	struct Mixed m;
	m.x = 1;
	m.a = 7;
	m.b = 3;
	m.y = 2;
	print(m.x);
	print(m.a);
	print(m.b);
	print(m.y);
	print(sizeof(m));

	struct Split s;
	s.a = 134217727;
	s.b = 1;
	print(s.a);
	print(s.b);
	print(sizeof(s));

	printflush(message1);
	stop();
}
