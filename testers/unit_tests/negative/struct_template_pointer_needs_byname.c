/* MESSAGE: a pointer to 'cvt' hands over a member that carries a NAME, so the par */
/* Must fail: a pointer to a struct with a name-carrying member has to be declared `byname`, or the callee reads `p->m` as an address that does not exist. */
#pragma noinline
#pragma optimize(struct_pointer)
#pragma optimize(pointer)
auto device message1;
struct tmpl { auto int *p; };
struct cvt { int *byname p; };
void handler(struct cvt *tmp) { print(*(tmp->p)); }
void main() {
    register struct tmpl m;
    extern int s;
    s = 5;
    m.p = byname(&s);
    handler(&m);
    printflush(message1);
}
