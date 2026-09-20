/* EXPECT: 50 40 99 17 */
auto device message1;
volatile int v;
void main() {
    int a[4] = {10, 20, 30, 40};
    int x = a[2];
    if (a[0] > 5) {
        x = x + a[1];
    }
    print(x);
    print(a[3]);
    a[1] = 99;
    print(a[1]);
    int i = v;
    print(a[i] + 7);
    printflush(message1);
    stop();
}
