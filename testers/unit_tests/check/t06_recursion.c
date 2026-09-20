/* EXPECT: 120 21 55 */
auto device message1;
int fact(int n) {
    if (n <= 1) return 1;
    return n * fact(n - 1);
}
int fib(int n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}
int tri(int n) {
    if (n <= 0) return 0;
    return n + tri(n - 1);
}
void main() {
    print(fact(5));
    print(fib(8));
    print(tri(10));
    printflush(message1);
    stop();
}
