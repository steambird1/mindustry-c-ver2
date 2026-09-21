#pragma optimize(struct_pointer, 2)
auto device message1;
struct pt { int x; int y; int z; };
register struct pt st;
void main() {
    struct pt *p = &st;
    p->x = 5;
    print(st.x);
    printflush(message1);
}
