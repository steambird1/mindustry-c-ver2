/* EXPECT: 1 2 */
/* A pointer member that carries a NAME: `struct s2 { int *byname ptr; }`.
   The write stores one word (the name) and the read has to be one word too --
   when the qualifier was dropped, the read took a block/offset pair instead and
   the two never met. */
/* EMIT: set g:\S*n\.ptr "g:\S*q" */
#pragma optimize(pointer)
auto device message1;
struct s1 { int *ptr; int n; };
struct s2 { int *byname ptr; int n; };
void main() {
    s1 m; s2 n;
    volatile int s;
    extern int q;
    m.ptr = &s;
    n.ptr = byname(&q);
    *(m.ptr) = 1;
    *(n.ptr) = 2;
    print(s); print(q);
    printflush(message1); stop();
}
