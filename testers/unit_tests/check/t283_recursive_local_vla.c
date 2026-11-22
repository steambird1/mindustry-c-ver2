/*
Local VLAs in recursive functions. Each invocation owns a dynamic frame
region; a nested call returns through the runtime-total marker and restores
the VLA base pointers, lengths and ordinary locals without replaying the
static prologue.
*/
/* EXPECT: 0 12 6 */
auto device message1;

int twoArrays(int n) {
    if (n <= 0) return 0;
    int a[n];
    int b[n];
    a[0] = n;
    b[0] = n;
    return a[0] + b[0] + twoArrays(n - 1);
}

int afterCall(int n) {
    if (n <= 0) return 0;
    int a[n];
    a[0] = n;
    int rest = afterCall(n - 1);
    return a[0] + rest;
}

void main() {
    print(twoArrays(0));
    print(twoArrays(3));
    print(afterCall(3));
    printflush(message1);
    stop();
}
