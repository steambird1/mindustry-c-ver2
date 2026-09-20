auto device message1;
struct witharr { int n; int data[3]; };
void main() {
    struct witharr a;
    struct witharr* pa = &a;
    a.n = 1;
    print(a.n);
    printflush(message1);
    stop();
}
