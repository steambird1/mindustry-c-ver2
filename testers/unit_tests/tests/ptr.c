auto device message1;
volatile int v;
void setp(int* p, int x) {
    *p = x;
}
void main() {
    int a = 3;
    setp(&a, 7);
    print(a);
    printflush(message1);
    stop();
}
