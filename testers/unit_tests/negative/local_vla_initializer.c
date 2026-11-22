/* MESSAGE: Variable length arrays are not supported: the size of 'a' must be a co */
/* A C99 VLA cannot be initialized; keep the clear compile-time diagnostic. */
void f(int n) {
    int a[n] = {0};
    a[0] = 1;
}

void main() {
    f(4);
}
