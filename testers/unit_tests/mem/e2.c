/* Definition forces memory: an array member. No copy is made, every instance
   is in memory whether it is addressed or not. */
auto device message1;
struct witharr { int n; int data[3]; };
void main() {
    struct witharr a;
    struct witharr b;
    struct witharr* pa = &a;
    a.n = 1;
    b.n = 2;
    b.data[1] = 5;
    print(a.n);
    print(b.n);
    print(pa->n);
    printflush(message1);
    stop();
}
