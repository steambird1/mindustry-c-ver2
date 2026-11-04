/*
`use(&x)` is inlined and only reads `widthof(p)`, so the name-pointer argument
it would have built has no remaining reader. The product-level pass removes the
dead temporary write instead of leaving it in the emitted program.
*/
/* EXPECT: 1 */
/* EMIT-NOT: set [^ ]+ "g:\.x__rdev" */
auto device message1;
extern int c;
typedef int rarr[4];
remote int x[4] = remote(@this, c);

void use(rarr *byname p) {
    print(widthof(p));
}

void main() {
    use(&x);
    printflush(message1);
    stop();
}
