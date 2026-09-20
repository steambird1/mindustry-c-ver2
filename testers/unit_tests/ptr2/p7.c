auto device message1;
volatile int v;
void main() {
    int y = 5;
    int x = 7;
    int z = x;
    int* q = &v;
    print(y);
    print(z);
    print(*q + 1);
    printflush(message1);
    stop();
}
