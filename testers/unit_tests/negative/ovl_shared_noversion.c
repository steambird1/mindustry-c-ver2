/* Two versions of 'add', four arguments -- no version matches. */
int add(int a, int b) { return a + b; }
int add(int a, int b, int c) { return a + b + c; }

void main() {
    int x = add(1, 2, 3, 4);
}
/* MESSAGE: No version of 'add' accepts these arguments \(int, int, int, int\) */
