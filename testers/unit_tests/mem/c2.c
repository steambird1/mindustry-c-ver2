auto device message1;
near int block[8];
volatile int vi;
void main() {
    int i = vi;
    block[i] = 3;
    print(block[i]);
    printflush(message1);
    stop();
}
