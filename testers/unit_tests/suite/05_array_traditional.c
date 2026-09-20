/* Ordinary memory array, with a run-time subscript. */
auto device message1;
volatile int vi;
int data[8];

void main() {
    int k;
    for (k = 0; k < 8; k++) {
        data[k] = k * k;
    }
    int i = vi;
    print(data[i]);
    print(data[3]);
    printflush(message1);
    stop();
}
