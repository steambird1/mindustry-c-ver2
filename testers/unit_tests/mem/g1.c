auto device message1;
struct pt { int x; int y; };
void main() {
    struct pt p;
    p.x = 1;
    struct pt* q = &p;
    print(q->x);
    printflush(message1);
    stop();
}
