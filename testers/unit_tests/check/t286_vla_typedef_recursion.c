/*
A VLA typedef inside a recursive function. The hidden length and each Row's
base pointer are part of the per-invocation dynamic frame and must survive the
nested call.
*/
/* EXPECT: 6 */
auto device message1;

int f(int n) {
    if (n <= 0) return 0;
    typedef int Row[n];
    Row a;
    a[0] = n;
    int rest = f(n - 1);
    return a[0] + rest;
}

void main() {
    print(f(3));
    printflush(message1);
    stop();
}
