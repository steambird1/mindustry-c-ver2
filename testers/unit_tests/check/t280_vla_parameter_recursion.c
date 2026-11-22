/*
VLA parameters in a recursive function. The parameter is a pointer into the
caller's storage, and the hidden length is per invocation; reading the array
before and after the nested call must both work.
*/
/* EXPECT: 10 10 */
auto device message1;

int sumBefore(int n, int a[n]) {
    if (n <= 0) return 0;
    int v = a[n - 1];
    return v + sumBefore(n - 1, a);
}

int sumAfter(int n, int a[n]) {
    if (n <= 0) return 0;
    int rest = sumAfter(n - 1, a);
    return a[n - 1] + rest;
}

void main() {
    int b[4] = {1, 2, 3, 4};
    print(sumBefore(4, b));
    print(sumAfter(4, b));
    printflush(message1);
    stop();
}
