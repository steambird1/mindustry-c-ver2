/* Recursion: every intermediate value must survive the nested calls. */
auto device message1;

int fact(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * fact(n - 1);
}

int fib(int n) {
    if (n < 2) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

void main() {
    print(fact(5));
    print(fib(8));
    printflush(message1);
    stop();
}
