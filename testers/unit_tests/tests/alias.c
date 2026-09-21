auto device message1;
volatile int v;
int f(int x) {
    int t = x + 1;
    return t * 2;
}
void main() {
    v = 5;
    int r = v + f(v) * 3;
    print(r);
    printflush(message1);
    stop();
}
