#pragma optimize(pointer)
auto device message1;
struct pt { int x; int y; };
void main() {
    struct pt p;
    p.x = 1;
    p.y = 2;
    int* q = &p.x;
    *q = 5;
    print(p.x);
    print(*q);
    printflush(message1);
    stop();
}
