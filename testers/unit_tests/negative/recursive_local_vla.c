/* MESSAGE: Local VLA 'a' in recursive function 'f' is not supported yet */
/*
A local VLA needs its dynamic frame restored around a nested call. Parameter
VLAs are pointers and work recursively; a frame-allocated local VLA is
rejected until the return protocol can preserve it.
*/
int f(int n) {
    if (n <= 0) return 0;
    int a[n];
    a[0] = n;
    return a[0] + f(n - 1);
}

void main() {
    f(3);
}
