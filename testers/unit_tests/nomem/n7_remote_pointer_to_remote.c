/* EXPECT: 88 88 */
/* No memory block is linked (see the `nomem` suite runner).

   `remote int *p = &rs;` is a (processor, name) pair, so `&rs` never becomes
   a local address: `rs` is named, not addressed, and it stays in registers
   over there. This is also the one form whose declarator is a plain
   `Declarator` node rather than a `VariableDeclarator` (a declaration that
   begins with `remote` does not go through the ordinary type path), so it
   covers both spellings of "the address of x is stored in a pointer". */
auto device message1;
extern int c;
remote int rs = remote(@this, c);
void main() {
    remote int *p = &rs;
    (*p) = 88;
    print(rs);
    print(c);
    printflush(message1); stop();
}
