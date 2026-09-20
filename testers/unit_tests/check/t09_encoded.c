/* EXPECT: 1 9 8 18 */
auto device message1;
volatile int v;
const int b[5] = array("encoded", {1, 9, 1, 9, 8});
void main() {
    print(b[0]);
    print(b[1]);
    int i = v;
    print(b[i + 4]);
    print(b[2] + b[3] + b[4]);
    printflush(message1);
    stop();
}
