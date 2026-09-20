auto device message1;
struct pt { int x; int y; };
int total(struct pt* p) { return p->x + p->y; }
void main() {
    struct pt a;
    struct pt b;
    struct pt* pa = &a;      /* degrades struct pt */
    a.x = 1; a.y = 2;
    b = a;                   /* struct copy while in memory */
    b.x = 9;
    print(total(pa));
    print(b.x);
    print(a.x);
    printflush(message1);
    stop();
}
