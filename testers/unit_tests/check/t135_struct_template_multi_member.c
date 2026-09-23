/* EXPECT: 5 9 7 */
/* More than one member, and only some of them carry names: the copy has to
   treat each the way it travels, not all as one word. */
#pragma optimize(pointer)
#pragma noinline
auto device message1;
struct tmpl { auto int *p; int n; int *q; };
struct cvt { int *byname p; int n; int *q; };
void handler(struct cvt tmp) {
    print(*(tmp.p));
    print(tmp.n);
    print(*(tmp.q));
}
void main() {
    struct tmpl m;
    extern int s;
    volatile int t;
    s = 5; t = 7;
    m.p = byname(&s);
    m.n = 9;
    m.q = &t;
    handler(m);
    printflush(message1); stop();
}
