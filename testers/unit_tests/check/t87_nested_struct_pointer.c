/* EXPECT: 4 9 */
/* A struct that CONTAINS another struct, kept in registers and reached
   through a name based pointer. */
#pragma optimize(struct_pointer)
auto device message1;
struct inner { int p; int q; };
struct outer { struct inner i; int n; };
register struct outer o;
void main() {
    struct outer *byname w = &o;
    w->n = 4;
    w->i.p = 9;
    print(o.n);
    print(o.i.p);
    printflush(message1);
}
