/* A little of everything: arrays, structs, pointers and recursion together.
   Run this with a small memory block to force the register layouts. */
#pragma optimize(pointer)
auto device message1;
volatile int seed;

struct point {
    int x;
    int y;
};

int table[4] = array("embedded_divided", {1, 2, 3, 4});

int step(int n) {
    if (n <= 0) {
        return 0;
    }
    return n + step(n - 1);
}

void main() {
    struct point p;
    p.x = 4;
    p.y = 5;
    int* px = &p.x;
    *px = *px + 1;

    int i = seed;
    table[i] = table[i] + 10;

    print(p.x + p.y);
    print(table[i]);
    print(step(4));
    printflush(message1);
    stop();
}
