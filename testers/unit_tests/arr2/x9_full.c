/* A complete program: constant arrays, if/else, for and while, pointers. */
#pragma optimize(pointer)
auto device message1;
volatile int vi;

int table[5] = {2, 4, 6, 8, 10};

int pick(int n) {
    if (n < 3) {
        return table[0] + table[1];
    }
    return table[4];
}

void main() {
    int acc = 0;
    int i;
    for (i = 0; i < 3; i++) {
        acc = acc + table[i];
    }
    int guard = 0;
    while (guard < 2) {
        acc = acc + 1;
        guard = guard + 1;
    }
    int x = 5;
    int* p = &x;
    *p = *p + pick(4);

    print(acc);        /* 2+4+6+2 = 14 */
    print(table[3]);   /* 8 */
    print(x);          /* 5 + 10 = 15 */
    print(vi + table[0]);
    printflush(message1);
    stop();
}
