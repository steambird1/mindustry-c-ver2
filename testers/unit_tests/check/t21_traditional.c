/* EXPECT: 200 200 200 200 */
/* The same array without the pragma: it stays in memory. */
auto device message1;
volatile int vi;
const int thre[4] = {200, 200, 200, 200};
void main() {
    int i = vi;
    while (i < 4) {
        print(thre[i]);
        i = i + 1;
    }
    printflush(message1);
    stop();
}
