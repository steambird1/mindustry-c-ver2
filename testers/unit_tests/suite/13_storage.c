/* volatile lives in memory; static and ordinary globals are kept in registers. */
auto device message1;
volatile int counter;
static int total = 0;
int plain = 3;

void bump() {
    counter = counter + 1;
    total = total + counter;
}

void main() {
    int i;
    for (i = 0; i < 4; i++) {
        bump();
    }
    print(counter);
    print(total);
    print(plain);
    printflush(message1);
    stop();
}
