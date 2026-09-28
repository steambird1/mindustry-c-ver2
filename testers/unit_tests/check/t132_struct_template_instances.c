/* EXPECT: 5 7 */
/* `struct tmpl { auto int *p; }` is a pattern. Two instances of it can settle
   differently -- one stores a name, the other an address -- and each becomes
   its own type, like two C++ template instantiations. */
#pragma optimize(pointer)
auto device message1;
struct tmpl { auto int *p; };
void main() {
    struct tmpl m, n;
    extern int s;
    volatile int t;
    s = 0; t = 0;
    m.p = byname(&s);
    n.p = &t;
    *(m.p) = 5;
    *(n.p) = 7;
    print(s); print(t);
    printflush(message1); stop();
}
