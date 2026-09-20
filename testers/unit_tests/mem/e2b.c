auto device message1;
struct witharr { int n; int data[3]; };
void main() {
    struct witharr a;
    struct witharr b;
    a.n = 1;
    b.n = 2;
    print(a.n);
    print(b.n);
    printflush(message1);
    stop();
}
