/*
A VLA typedef is runtime-sized even when no object is declared from it.
The hidden bound is initialized at the typedef declaration, so sizeof(Row)
must read it instead of folding to zero.
*/
/* EXPECT: 5 */
auto device message1;

void f(int n) {
    typedef int Row[n];
    print(sizeof(Row));
}

void main() {
    f(5);
    printflush(message1);
    stop();
}
