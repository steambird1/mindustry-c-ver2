/* EXPECT: 5 7 5 7 */
/* A pointer to a struct that lives in ANOTHER processor: it carries the name
   of every member plus the device, so `p->x` is one remote read/write. */
#pragma optimize(struct_pointer)
auto device message1;
struct pt { int x; int y; };
register struct pt st;
void main() {
    remote struct pt *p = remote(@this, &st);
    p->x = 5;
    p->y = 7;
    print(st.x);
    print(st.y);
    print(p->x);
    print(p->y);
    printflush(message1);
}
