/* EXPECT: 4 7 */
/* The same open-dimension parameter, reached through a FUNCTION POINTER -- the
   one case where the parameter symbol is not available and the slot's own type
   is all there is to go on.

   `deliverArgument` decided what to send from the parameter's representation,
   and with nothing known about the callee it fell back to "unless the type says
   `remote`, send a pointer". So the call site wrote `__param_0_block` and
   `__param_0_pos` while the callee read one packed `__param_0`: the write went
   into a helper address made of two address halves, the program looped until it
   ran out of steps, and it printed nothing at all.

   A slot with an open dimension now asks for a handle on its own account, since
   a pointer into it cannot say how far it goes. `EMIT-NOT` pins the shape --
   the block/offset pair is exactly what must not come back -- and the helpers
   being generated is the memory array being wrapped on the spot, which had no
   test anywhere before this one. */
/* EMIT: op add ___arrget_\S+ @counter 1 */
/* EMIT: op add ___arrset_\S+ @counter 1 */
/* EMIT-NOT: __param_0_block */
/* EMIT-NOT: __param_0_pos */
auto device message1;
typedef void (*cb)(int s[]);
void put(int s[]) {
    s[0] = 7;
    print(lenof(s));
}
void main() {
    int a[4];
    cb p = put;
    p(a);
    print(a[0]);
    printflush(message1); stop();
}
