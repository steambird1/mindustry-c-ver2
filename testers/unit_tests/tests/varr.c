auto device message1;
volatile int varr[4];
void main() {
    varr[0] = 1;
    varr[1] = varr[0] + 1;
    print(varr[1]);
    printflush(message1);
    stop();
}
