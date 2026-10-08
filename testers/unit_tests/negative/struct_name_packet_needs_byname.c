/* MESSAGE: '&s' hands a struct pointer that carries member NAMES, so the paramete */
/* Must fail: `&s` on a struct held in registers hands a pointer that carries
   member NAMES, so the parameter has to be declared `byname`. Without it the
   callee would read it as an address that was never assigned. */
#pragma optimize(struct_pointer)
#pragma noinline
auto device message1;
struct pt { int x; int y; };
register struct pt s;
void use(struct pt *p) { p->x = 3; }
void main() {
    use(&s);
    print(s.x);
    printflush(message1);
}
