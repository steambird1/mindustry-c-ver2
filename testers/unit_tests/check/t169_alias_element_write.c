/*
`int a[] = mem;` is an alias, not a copy: the alias IS the array it names, so
`a[i] = x` writes `mem`. Reads already worked; writes used to go wrong in
three different ways:

- a small constant target (`int init[4] = {1,2,3,4}`) is auto-promoted to an
  encoded table when nothing writes it, and a write through the alias then
  crashed with `Internal parser error: an encoded array is constant`;
- an embedded target let the write land in the alias's own view, so `a[0]`
  read 9 while `mem[0]` stayed 1;
- an alias of an alias was not followed at all.

The optimizer now follows `arrayAliasOf` before touching the constant
bookkeeping, so the target is neither promoted to a constant nor folded back
to its initial value. Each line below writes through an alias and reads the
OWNER, not the alias, so a copy would fail the EXPECT.

The runner re-runs this under `#pragma noinline` and the other invariance
pragmas.
*/
/* EXPECT: 9 7 8 6 */
auto device message1;

int mem[4];
int init[4] = {1, 2, 3, 4};
int emb[4] = array("embedded_divided", {1, 2, 3, 4});
int a[] = init;
int b[] = a;

void main() {
	mem[0] = 5;
	int h[] = mem;
	h[0] = 9;
	print(mem[0]);          // 9: a local alias of genuine memory

	a[0] = 7;
	print(init[0]);         // 7: the small initializer is not encoded

	emb[0] = 8;
	print(emb[0]);          // 8: the embedded target sees the write

	b[1] = 6;
	print(init[1]);         // 6: alias of an alias reaches the root
	printflush(message1);
	stop();
}
