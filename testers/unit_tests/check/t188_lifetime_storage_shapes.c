/*
Storage shapes across two runs (`// RUNS: 2`).

- `static` array with an explicit embedded layout: the initializer runs once
  per run, so both calls in a run print 2 then 3;
- `static` uninitialized array: zeroed at the start of each run, prints 0
  both times;
- `persistent` array with an embedded layout: 2/3 in the first run and 4/5 in
  the second;
- `static` struct without an initializer: zeroed each run;
- an ordinary global without an initializer: reset each run.

Expected: `2 3 0 2 3 0 0 2 3 0 4 5 0 0`.
*/
// RUNS: 2
/* EXPECT: 2 3 0 2 3 0 0 2 3 0 4 5 0 0 */
auto device message1;

struct S {
	int x;
};

int ordinary;

int static_array() {
	static int a[2] = array("embedded_divided", {1, 2});
	a[0] = a[0] + 1;
	return a[0];
}

int static_uninitialized() {
	static int a[2];
	int value = a[0];
	a[0] = a[0] + 1;
	return value;
}

int persistent_array() {
	persistent int a[2] = array("embedded_divided", {1, 2});
	a[0] = a[0] + 1;
	return a[0];
}

int static_struct() {
	static struct S s;
	int value = s.x;
	s.x = s.x + 1;
	return value;
}

void main() {
	print(static_array());
	print(static_array());
	print(static_uninitialized());

	print(persistent_array());
	print(persistent_array());

	print(static_struct());

	print(ordinary);
	ordinary = ordinary + 1;

	printflush(message1);
	end();
}
