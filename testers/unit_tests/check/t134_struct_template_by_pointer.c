/* EXPECT: 5 */
/* The same through a pointer. `&m` on a struct in registers carries member
   NAMES, so the parameter has to be declared `byname` -- the callee reads
   `p->m` differently then. */
#pragma optimize(struct_pointer)
#pragma optimize(pointer)
#pragma noinline
auto device message1;
struct tmpl { auto int *p; };
struct cvt { int *byname p; };
void handler(struct cvt *byname tmp) { print(*(tmp->p)); }
void main() {
    register struct tmpl m;
    extern int s;
    s = 5;
    m.p = byname(&s);
    handler(&m);
    printflush(message1); stop();
}
