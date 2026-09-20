/* EXPECT: 15 31 4 */
auto device message1;
struct inner { int a; int b; };
struct outer { struct inner i; int c; };
void main() {
    struct outer o;
    o.i.a = 4;
    o.i.b = 5;
    o.c = 6;
    print(o.i.a + o.i.b + o.c);
    struct outer p;
    p = o;
    p.i.a = 20;
    print(p.i.a + p.i.b + p.c);
    print(o.i.a);
    printflush(message1);
    stop();
}
