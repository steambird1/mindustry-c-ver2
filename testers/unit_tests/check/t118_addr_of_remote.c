/* EXPECT: 88 88 */
/* EMIT: write 88 g:[^ ]*p__rdev  */
/* EMIT-NOT: getlink __curb */
/* `&rs` where `rs` is a `remote` variable.

   A remote variable is reached as (processor, name), so a pointer to it has to
   BE that pair -- it cannot be a block/offset pair, because the block half
   would be read as a building number that was never assigned. Declared
   `remote int *`, the pointer is stored the same way and `(*p) = v` writes
   through to the remote variable. */
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
