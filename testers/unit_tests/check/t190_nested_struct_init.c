/*
Nested struct initialization, including the `extractKth` bug that used to
crash on `{{1, 2}, 3}`.

- a `static` nested struct with an initializer is re-initialized each run;
- a `persistent` nested struct keeps its value across runs;
- a static nested struct containing a pointer member zeroes the non-pointer
  members but deliberately leaves the pointer alone (Mindustry has no
  meaningful null address to write).

Expected: `123 223 0 0` in the first run and `123 323 0 0` in the second.
*/
// RUNS: 2
/* EXPECT: 123 223 0 0 123 323 0 0 */
auto device message1;

struct Inner {
	int x;
	int y;
};

struct Outer {
	struct Inner in;
	int z;
};

struct PInner {
	int *p;
	int y;
};

struct POuter {
	struct PInner in;
	int n;
};

int static_nested() {
	static struct Outer o = { {1, 2}, 3 };
	return o.in.x * 100 + o.in.y * 10 + o.z;
}

int persistent_nested() {
	persistent struct Outer o = { {1, 2}, 3 };
	o.in.x = o.in.x + 1;
	return o.in.x * 100 + o.in.y * 10 + o.z;
}

int pointer_member_y() {
	static struct POuter o;
	return o.in.y;
}

int pointer_member_n() {
	static struct POuter o;
	return o.n;
}

void main() {
	print(static_nested());
	print(persistent_nested());
	print(pointer_member_y());
	print(pointer_member_n());

	printflush(message1);
	end();
}
