/*
A function-scope VLA typedef evaluates its bound once. Every object declared
through the alias gets its own runtime-sized storage but shares that length.
*/
/* EXPECT: 3 6 4 4 4 4 1 */
auto device message1;

void f(int n) {
    typedef int Row[n];
    Row a;
    Row b;

    for (int i = 0; i < n; i++) {
        a[i] = i;
        b[i] = i * 2;
    }

    print(a[n - 1]);
    print(b[n - 1]);
    print(sizeof(Row));
    print(sizeof(a));
    print(lenof(a));
    print(lenof(b));
    print(sizeof(a[0]));
}

void main() {
    f(4);
    printflush(message1);
    stop();
}
