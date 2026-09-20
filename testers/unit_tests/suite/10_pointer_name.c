/* #pragma optimize(pointer): &x becomes the NAME of x, read with `read @this`. */
#pragma optimize(pointer)
auto device message1;

void swap(int* a, int* b) {
    int t = *a;
    *a = *b;
    *b = t;
}

void main() {
    int x = 5;
    int y = 9;
    int* p = &x;
    int* q = p;
    *p = 7;
    print(x);
    print(*q);
    y = *p + 1;
    print(y);
    printflush(message1);
    stop();
}
