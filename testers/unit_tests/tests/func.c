auto device message1;
int add(int a, int b) {
    return a + b;
}
int fact(int n) {
    if (n <= 1) return 1;
    return n * fact(n - 1);
}
void main() {
    print(add(2, 3));
    print(fact(4));
    printflush(message1);
    stop();
}
