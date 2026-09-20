auto device message1;
struct a { int x; };
struct b { struct a inner; int y; };
struct c { struct b mid; int z; };
void main() {
    struct a aa;
    aa.x = 1;
    struct a* pa = &aa;      /* degrades a -> b -> c */
    struct c cc;
    cc.mid.inner.x = 5;
    cc.z = 6;
    print(cc.mid.inner.x);
    print(pa->x);
    printflush(message1);
    stop();
}
