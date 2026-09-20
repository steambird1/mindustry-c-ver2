/* The whole point: two instances of the SAME struct, only one is addressed. */
auto device message1;
struct pt { int x; int y; };
void main() {
    struct pt a;      /* addressed -> memory copy */
    struct pt b;      /* never addressed -> stays in registers */
    struct pt* pa = &a;
    a.x = 1;
    b.x = 2;
    print(b.x);       /* plain register read */
    print(pa->x);     /* through memory */
    printflush(message1);
    stop();
}
