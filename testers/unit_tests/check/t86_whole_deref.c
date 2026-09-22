/* EXPECT: 3 4 3 7 */
/* `*p` as a whole: the members are the registers NAMED by the packet, so
   `(*p).x` reads through `p.x` instead of stepping an address the packet
   never had. */
#pragma optimize(struct_pointer)
auto device message1;
struct pt { int x; int y; };
register struct pt st;
void main() {
    struct pt *p = &st;
    struct pt src;
    src.x = 3; src.y = 4;
    (*p) = src;
    print(st.x);
    print(st.y);
    src.x = 7;
    print((*p).x);
    print(src.x);
    printflush(message1);
}
