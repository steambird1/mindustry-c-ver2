/* MESSAGE: Variable length array member 'a' is not allowed: C99 requires a struct or union member to have a constant size */
/*
C99 forbids a variably modified member: a struct's size must be known at
compile time. The diagnostic names the member instead of silently treating
the open dimension as size 1.
*/
void f(int n) {
    struct S {
        int a[n];
    };
}

void main() {
    f(4);
}
