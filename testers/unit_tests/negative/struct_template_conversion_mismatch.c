/* Must fail: `n.p` is given an address, so `n` settles on the memory
   representation -- which does not convert into a struct that spells out
   `int *byname p`. */
#pragma optimize(pointer)
auto device message1;
struct tmpl { auto int *p; };
struct cvt { int *byname p; };
void handler(struct cvt tmp) { print(*(tmp.p)); }
void main() {
    struct tmpl n;
    volatile int t;
    n.p = &t;
    handler(n);
    printflush(message1);
}
