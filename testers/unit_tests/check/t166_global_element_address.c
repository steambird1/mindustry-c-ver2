/*
The address of a GLOBAL array element or struct field used to be wrong even
though plain subscripts worked. Two separate pieces were missing:

  - a global array's live pair `X_block` / `X_pos` was never written at boot:
    only the `X.__pointer` slot was, so `&arr[2]` dereferenced through an
    uninitialised register pair and resolved to the first link (a trap);
  - a global struct with an initializer list never got its VALUE into memory:
    the boot-time copy called `__pointerForward`, whose register is only set
    by the function machinery that runs after the boot declarators, so the
    call jumped back to the start of the program (a step limit).

The pair is now assigned from the container's own memory location at boot
(first EMIT), and the struct's initializer stores each member straight into
its own cell, like the array initializer list does (second EMIT) -- no helper
function call at boot.

This is the global half of address-taking: local addresses (`&a[i]` on a
local array, `&s.x` on a local struct) already worked; t160 documents the
local-only shape this case now completes.
*/
/* EXPECT: 4 5 4 2 */
/* EMIT: set g:\.arr_block [^ ]+ */
/* EMIT: set g:\.arr_pos \d+ */
/* EMIT: write g:\.__tempsym_0\.x [^ ]+ [^ ]+ */
auto device message1;
struct P { int x; int y; };
struct P s = {4, 5};
int arr[4] = {2, 3, 4, 5};
void main() {
    int *t = &arr[2];
    print(*t);
    int *u = &s.y;
    print(*u);
    int *v = &s.x;
    print(*v);
    int *w = &arr[0];
    print(*w);
    printflush(message1);
    stop();
}