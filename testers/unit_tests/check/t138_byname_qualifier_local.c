/* EXPECT: 5 */
/* The `byname` qualifier is a request about the POINTER, not about where the
   target lives: `int *byname q` keeps q one register long, and the variable it
   points at stays in a register of its own -- no block, no offset, and none of
   the `X_block` / `X_pos` pair. */
auto device message1;
void main() {
    int w = 3;
    int *byname q;
    q = &w;
    (*q) = 5;
    print(w);
    printflush(message1);
}
