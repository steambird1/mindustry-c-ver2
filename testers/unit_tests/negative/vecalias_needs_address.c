/* Must fail: `vecalias` wants the ADDRESS of a handle, not a bare name and
   not an arbitrary pointer.

   A handle is ONE register, so the address of a handle is a one-word name
   pointer -- the cheapest thing that can carry it, and the reason the intrinsic
   exists at all. A bare `a` names the handle rather than the cell, and a
   `int *p` is the address of an address: neither is a place a handle can be
   written into, and either would bind something the program never reads.

   Both spellings are here because they are refused for the same reason and it
   is the SAME check: a case that only asked about one would still pass if the
   `&` were dropped from the signature. */
/* MESSAGE: The first argument of vecalias must be the address of a handle */
/* MESSAGE: The first argument of vecalias must be the address of a handle */
int mem[4];
int a[];
void main() {
    int *p;
    a = mem;
    vecalias(a, mem);
    vecalias(p, mem);
}
