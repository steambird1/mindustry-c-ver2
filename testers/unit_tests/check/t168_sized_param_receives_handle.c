/*
A SIZED array parameter (`int s[4]`) is normally delivered as a two-word
pointer, and that is right for an in-memory argument. But a bound unbound
handle (`int h[]; h = e;`) is ONE register holding a packed handle, whatever
it was bound to. Passing it used to build a pointer from that one word and
read through garbage -- the sized-parameter trap recorded in OPEN_WORK §6.
The call-site note now says "handle" for any unbound-handle symbol, so the
parameter arrives in the same shape as its argument.

Both representations are here: `h = e` binds an embedded (divided) array, and
`h = m` binds a memory one. For each, the callee reads the elements and the
packed length, writes one element through the handle, and the caller sees the
write -- so the handle reaches the caller's storage, not a copy. The runner
applies `#pragma noinline` and the other invariance pragmas, which is the
out-of-line delivery path this pins.
*/
/* EXPECT: 1 4 9 5 4 9 */
auto device message1;

int e[4] = array("embedded_divided", {1, 2, 3, 4});
int m[4] = {5, 6, 7, 8};

void touch(int s[4]) {
	print(s[0]);
	print(lenof(s));
	s[1] = 9;
}

void main() {
	int h[];
	h = e;
	touch(h);
	print(e[1]);
	h = m;
	touch(h);
	print(m[1]);
	printflush(message1);
	stop();
}
