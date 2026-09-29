/* EXPECT: 88 88 1 1 2 5 */
/* EMIT: write 88 g:[^ ]*p__rdev  */
/* EMIT: set [^ ]* "g:\.x__rdev"  */
/* EMIT: set [^ ]*q_block g:[^ ]*a_block  */
/* EMIT: set [^ ]*q_pos g:[^ ]*a_pos  */
/* `&rs` where `rs` is a `remote` variable.

   A remote variable is reached as (processor, name), so a pointer to it has to
   BE that pair -- it cannot be a block/offset pair, because the block half
   would be read as a building number that was never assigned. Declared
   `remote int *`, the pointer is stored the same way and `(*p) = v` writes
   through to the remote variable.

   The ARRAY rows of the `&` matrix: the address of a remote array is the
   LOCAL handle cell -- the one register that names the other processor -- so
   `&x` is ONE word and stores a NAME (`"g:..x__rdev"`), while `&a` on a
   memory array is its real address, a two-word block/offset pair. The EMITs
   pin the difference in the SAME program, `widthof` agrees (1 vs 2), and the
   write through `q[0][2]` proves the pair actually reaches the elements. */
auto device message1;
extern int c;
typedef int rarr[4];
typedef int arr[4];
remote int rs = remote(@this, c);
remote int x[4] = remote(@this, c);
void use(rarr *byname p) {
    print(widthof(p));
}
void main() {
    remote int *p = &rs;
    (*p) = 88;
    print(rs);
    print(c);
    print(widthof(&x));
    use(&x);
    int a[4];
    arr *q = &a;
    print(widthof(&a));
    q[0][2] = 5;
    print(a[2]);
    printflush(message1); stop();
}