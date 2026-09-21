auto device message1;
struct inner { int a; int b; };
struct outer { struct inner i; int c; };
void main() {
    struct outer o;
    o.i.a = 1;
    print(o.i.a);
    printflush(message1);
    stop();
}
