#pragma optimize(struct_pointer)
auto device message1;
struct pt { int a; int b; };
register struct pt st;
void main() {
    struct pt *byname p = &st;
    p->a = 11;
    p->b = 22;
    print(st.a);
    print(st.b);
    printflush(message1);
}
