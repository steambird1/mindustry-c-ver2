/*
Two function-scope local VLAs in one function. Each declaration allocates its
runtime cells and leaves a new frame-total marker; both arrays remain usable
until the function returns.
*/
/* EXPECT: 15 5 6 3 5 3 */
auto device message1;

void f(int n, int m) {
    int a[n];
    int b[m];
    for (int i = 0; i < n; i++) a[i] = i + 1;
    for (int j = 0; j < m; j++) b[j] = j + 1;

    int sa = 0, sb = 0;
    for (int i = 0; i < n; i++) sa += a[i];
    for (int j = 0; j < m; j++) sb += b[j];

    print(sa);
    print(sizeof(a));
    print(sb);
    print(sizeof(b));
    print(lenof(a));
    print(lenof(b));
}

void main() {
    f(5, 3);
    printflush(message1);
    stop();
}
