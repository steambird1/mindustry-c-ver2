/* EXPECT: 5 7 1 7 5 7 1 7 */
/* An array written `int s[]` leaves its length open, so it is a HANDLE: that
   is the one form that carries the length (and the element size) beside the two
   helpers that reach the elements. It used to be handed over as a pointer, and
   then `lenof(s)` had nothing to read and answered 0 -- the same source gave 0
   through a call and 0 again when inlined, and neither was the five elements
   that were actually there.

   Both kinds of argument are here, because the point is that a handle takes
   either: an array in memory is wrapped (the get / set helpers are generated
   for it on the spot), and an array already in registers is handed as it is.
   `print(mem[1])` and `print(div[1])` afterwards are what show the write landed
   in the CALLER's array rather than in a copy.

   `#pragma noinline` is one of the pragmas check.mjs re-runs every test under,
   so the kept-call path is checked by the same expected output: a handle built
   at the call site and one folded into an alias must agree, which is the whole
   reason the model is worth having.

   THE HANDLE ROW OF THE `&` MATRIX: `&s` takes the address of the handle CELL
   -- the one register that names the array -- so it is ONE word. Before the
   `&` resolution was tiered, `&` on an unsized array parameter was refused
   (a pointer into storage that has no address). `widthof(&s)` prints 1, the
   same width `widthof(s)` would, because a handle is one register and its
   address is a name pointer to that register. */
auto device message1;
void put(int s[]) {
    s[1] = 7;
    print(lenof(s));
    print(s[1]);
    print(widthof(&s));
}
void main() {
    int mem[5];
    mem[1] = 3;
    put(mem);
    print(mem[1]);
    int div[5] = array("embedded_divided");
    div[1] = 3;
    put(div);
    print(div[1]);
    printflush(message1); stop();
}
