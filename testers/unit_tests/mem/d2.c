auto device message1;
struct inner { int a; int b; };
struct outer { struct inner i; int c; };
void main() {
    struct inner in;          /* no address taken -> stays in registers */
    in.a = 7;
    struct outer o;
    o.i.a = 1;
    print(in.a);
    print(o.i.a);
    printflush(message1);
    stop();
}
