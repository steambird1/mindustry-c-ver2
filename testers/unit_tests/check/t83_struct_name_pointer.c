/* EXPECT: 5 7 5 7 */
/* A name based pointer to a struct held in registers: `p->x` is one
   `read`/`write` through a name, with no memory involved at all. */
#pragma optimize(struct_pointer)
auto device message1;
struct pt { int x; int y; };
register struct pt st;
void main() {
    struct pt *p = &st;
    p->x = 5;
    p->y = 7;
    print(st.x);
    print(st.y);
    print(p->x);
    print(p->y);
    printflush(message1);
}
