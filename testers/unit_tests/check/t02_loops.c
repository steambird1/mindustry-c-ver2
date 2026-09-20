/* EXPECT: 45 10 24 */
auto device message1;
volatile int v;
void main() {
    int sum = 0;
    int i;
    for (i = 1; i <= 9; i++) {
        sum = sum + i;
    }
    print(sum);                /* 45 */
    int n = 0;
    while (n < 10) {
        n = n + v + 1;
    }
    print(n);                  /* 10 */
    int acc = 1;
    int k = 1;
    while (k <= 4) {
        acc = acc * k;
        k = k + 1;
    }
    print(acc);                /* 24 */
    printflush(message1);
    stop();
}
