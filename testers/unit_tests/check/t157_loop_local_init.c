/* EXPECT: 7 14 */
/* A local declared inside a loop body, then read later in that same body,
   must be initialised. `t = b` is a real store; if the optimiser treats the
   declaration as foldable it drops the store and `a = t` then reads a
   register nobody wrote.

   The second loop is what makes this fail: `t` is a different `t` in `main`,
   and the usage analysis for one loop body decides the other. Removing the
   second loop makes the miscompile disappear, which is why this file has
   both. */
auto device message1;
int gcd(int a, int b) {
    while (b != 0) {
        int t = b;
        b = a - (a / b) * b;
        a = t;
    }
    return a;
}
void main() {
    print(gcd(28, 35));
    int t = 0;
    int i;
    for (i = 0; i < 4; i++) {
        if (i == 2) { t = t + 10; } else { t = t + i; }
    }
    print(t);
    printflush(message1);
    stop();
}
