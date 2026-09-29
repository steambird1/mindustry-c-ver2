/* EXPECT: 7 7 5 3 5 41 2 3 9 9 3 */
/* EMIT: op add ___arrget_g__mem @counter 1 */
/* EMIT: op add ___arrset_g__mem @counter 1 */
/* EMIT: set [^ ]*\ba ___arrget_ */
/* EMIT: op or [^ ]*\ba [^ ]*\ba \d{6,} */
/* EMIT-NOT: [^ ]*\ba_block\b */
/* `int a[];` -- declared, sized by nothing -- used to be refused outright: "The
   size of array 'a' is neither given nor deducible". It is not an array of its
   own at all. It is a one-word CELL that later names one, and the binding is an
   ordinary assignment, `a = mem;`.

   What goes into the cell is the packed handle: the two helper entry points,
   the length and the element size. So after the binding `a[1]` reaches
   `mem[1]`, and `lenof(a)` is 5 -- a length that appears NOWHERE in the source,
   since `a` never wrote one down. It is taken, not computed.

   `print(mem[1])` after each write through `a` is what shows the two names
   reach ONE array. A copy would print the old element, and a cell with nothing
   behind it could not print anything at all.

   A handle may be bound to a handle (`b = a;`) because the value IS the handle:
   there is nothing to re-pack, and `b[0] = 3` is visible through `a`.

   REBINDING is allowed, and that is the point of keeping the cell: it is a
   NAME, not an array. `a = other;` leaves `mem` exactly as it was.

   The shape assertions pin what the form costs. The cell is ONE register --
   `a_block` / `a_pos` are what a memory array would need, and the EMIT-NOT says
   they are not there -- and the binding is `packHandle`'s own arithmetic: the
   set helper shifted up beside the get helper, then the length. The helpers
   are generated for `mem` exactly as they are for an `int s[]` parameter
   handed `mem`, which is why `___arrget`/`___arrset` appear once each. */
auto device message1;
int mem[5];
int a[];
int b[];
int other[2] = {41, 42};
void main() {
    a = mem;
    a[1] = 7;
    print(a[1]);
    print(mem[1]);
    print(lenof(a));

    b = a;
    b[0] = 3;
    print(a[0]);
    print(lenof(b));

    a = other;
    print(a[0]);
    print(lenof(a));
    print(mem[0]);

    int loc[3] = {1, 2, 3};
    int h[];
    h = loc;
    h[2] = 9;
    print(h[2]);
    print(loc[2]);
    print(lenof(h));
    printflush(message1);
    stop();
}
