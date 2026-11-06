/*
`byname` on a flat register struct is a name packet: one name per scalar leaf.
Device and string_t leaves are single registers and stay nameable. No pointer
block/offset arithmetic is used for p->n.
*/
/* EXPECT: 7 7 3 3 */
/* EMIT: set [^ ]*p\.n "g:\.x\.n" */
/* EMIT: write 7 @this [^ ]*p\.n */
/* EMIT-NOT: getlink __curb */
auto device message1;
struct S { device d; string_t s; int n; };
S x;

void main() {
    S *byname p = byname(&x);
    p->d = @this;
    p->s = "hi";
    p->n = 7;
    print(p->n);
    print(x.n);
    p->n = 3;
    print(p->n);
    print(x.n);
    printflush(message1);
    stop();
}
