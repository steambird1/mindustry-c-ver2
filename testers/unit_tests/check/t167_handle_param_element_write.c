/*
An open-dimension array parameter (`int s[]`) arrives as a packed handle BY
VALUE. Writing ELEMENTS through it -- `s[i] = ...` -- reaches the caller's
array, which is what a handle is for, and it does so in every compile mode.

This is the supported half of the array-parameter story. The unsupported half,
assigning the parameter itself (`s = b;`), is refused at semantic time because
it could only rebind the callee's copy: see
negative/array_parameter_assignment_refused.c.

The runner applies `#pragma noinline` (and the other invariance pragmas) to
this source, so the out-of-line call path and the inlined one must both reach
the caller's storage. `copyThrough` exercises the loop, `bump` a single store.
*/
/* EXPECT: 1 8 3 */
auto device message1;

int src[3] = {1, 2, 3};

void copyThrough(int s[], int b[]) {
	int i;
	for (i = 0; i < 3; i++) s[i] = b[i];
}

void bump(int s[]) {
	s[1] = 8;
}

void main() {
	int m[3] = {5, 6, 7};
	copyThrough(m, src);
	bump(m);
	print(m[0]);
	print(m[1]);
	print(m[2]);
	printflush(message1);
	stop();
}
