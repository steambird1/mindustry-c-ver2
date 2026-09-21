auto device message1;
struct inner { int a; int b; };
struct outer { struct inner i; int c; };
void main() {
    struct outer o;
    o.i.a = 1;
    o.i.b = 2;
    o.c = 3;
    struct outer q;
    q = o;
    q.i.b = 7;
    print(o.i.a + o.i.b + o.c);
    print(q.i.a + q.i.b + q.c);
    printflush(message1);
    stop();
}
