auto device message1;
int add(int a, int b) { return a + b; }
int sq(int x) { return x * x; }
void main() {
    print(add(sq(2), add(1, sq(3))));
    printflush(message1);
    stop();
}
