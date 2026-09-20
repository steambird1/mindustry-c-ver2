/* array("encoded"): a constant array kept as a string. */
auto device message1;
volatile int vi;
const int b[5] = array("encoded", {1, 9, 1, 9, 8});

void main() {
    int i = vi;
    print(b[i]);
    print(b[0] + b[4]);
    printflush(message1);
    stop();
}
