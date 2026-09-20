/* A volatile array must stay in memory even when memory is scarce. */
auto device message1;
volatile int varr[8];
int filler[64];
void main() {
    varr[2] = 7;
    print(varr[2]);
    printflush(message1);
    stop();
}
