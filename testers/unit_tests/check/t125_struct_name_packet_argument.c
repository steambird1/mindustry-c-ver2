/* EXPECT: 3 4 */
/* A pointer to a struct held in registers carries the NAME of every member.
   Handing such a pointer to a function works only if the function knows it:
   the parameter has to be declared `byname`, or the callee would read it as an
   address that was never assigned. */
/* EMIT: write 3 @this g:\.f:use\.p\.x */
#pragma optimize(struct_pointer)
#pragma noinline
auto device message1;
struct pt { int x; int y; };
register struct pt s;
void use(struct pt *byname p) { p->x = 3; p->y = 4; }
void main() {
    use(&s);
    print(s.x); print(s.y);
    printflush(message1); stop();
}
