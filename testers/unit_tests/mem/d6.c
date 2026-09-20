#pragma optimize(pointer)
auto device message1;
struct pt { int x; int y; };
void main() {
    struct pt p;
    p.x = 1;
    int* px = &p.x;          /* member address: stays in registers */
    struct pt* q = &p;       /* whole struct: degrades to memory  */
    *px = 4;
    print(p.x);
    print(q->y);
    printflush(message1);
    stop();
}
