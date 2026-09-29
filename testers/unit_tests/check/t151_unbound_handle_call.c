/* EXPECT: 42 5 42 42 5 42 0 5 */
/* EMIT: set g:\.f:poke\.s g:\.a */
/* EMIT-NOT: op or [^ ]*g:\.f:poke\.s [^ ]*g:\.f:poke\.s \d */
/* A bound handle can be HANDED TO A FUNCTION, which is what a handle is for.

   `poke(a)` puts the value in hand into the parameter slot and stops: the
   packed handle is copied as ONE register. The EMITs say exactly that -- a
   `set` of the cell, and no `packHandle` arithmetic, because there is nothing
   left to pack: the helpers are line numbers of THIS program and there is no
   array behind the value to ask about. Before this the call died with "Array 'a'
   cannot be handed to a function: it has no representation that travels as a
   value", which was true of a handle PARAMETER too.

   `relay(a)` passes it on: handle to handle, one store each. That is the
   property a pointer has and a handle parameter never had.

   And a handle is a NAME, not a value that lives in a function: `setup()` binds
   the global `a` and `show()` reads it back, in a different call, with the
   length still answering 5.

   `#pragma noinline` is one of the pragmas check.mjs re-runs every test under,
   so the kept-call path is held to the same expected output: a handle passed in
   one store and a handle folded into an alias must agree. */
auto device message1;
int mem[5];
int a[];
void poke(int s[]) {
    s[1] = 42;
    print(s[1]);
    print(lenof(s));
}
void relay(int t[]) {
    poke(t);
}
void setup() {
    a = mem;
}
void show() {
    print(a[2]);
    print(lenof(a));
}
void main() {
    setup();
    poke(a);
    print(mem[1]);
    relay(a);
    print(mem[1]);
    show();
    printflush(message1);
    stop();
}
