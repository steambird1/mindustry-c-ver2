/* EXPECT: 11 22 */
/* The same, but the function is kept as a real call. */
#pragma optimize(struct_pointer)
#pragma noinline(fill)
auto device message1;
struct pt { int a; int b; };
register struct pt st;
void fill(struct pt *byname q) {
    q->a = 11;
    q->b = 22;
}
void main() {
    struct pt *p = &st;
    fill(p);
    print(st.a);
    print(st.b);
    printflush(message1);
}
