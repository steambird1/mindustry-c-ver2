/* EXPECT: 1 7 */
auto device message1;
struct inner { int a; int b; };
struct outer { struct inner i; int c; };
void main() {
    struct inner in;
    in.a = 7;
    struct inner* pi = &in;      /* forces struct inner into memory */
    struct outer o;              /* must therefore be in memory too  */
    o.i.a = 1;
    o.i.b = 2;
    o.c = 3;
    print(o.i.a);
    print(pi->a);
    printflush(message1);
    stop();
}
