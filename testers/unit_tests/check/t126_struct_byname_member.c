/* EXPECT: 1 2 */
/* A pointer member that carries a NAME: `struct s2 { int *byname ptr; }`.
   The write stores one word (the name) and the read has to be one word too --
   when the qualifier was dropped, the read took a block/offset pair instead and
   the two never met. */
/* The NAME of `q` is a string, so it is materialised into a temporary and then
   stored into the member -- the two steps are separate, so the assertion is
   written for both. What matters is the last line: the write goes out through
   `@this` at the name, not through a block. */
/* EMIT: set g:\S*__tempsym_ptr_0 "g:\S*q" */
/* EMIT: set g:\S*n\.ptr g:\S*__tempsym_ptr_0 */
/* EMIT: write 2 @this g:\.f:main\.b:1\.n\.ptr */
/* EMIT-NOT: write 2 __curb g:\.f:main\.b:1\.n\.ptr_pos */
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
