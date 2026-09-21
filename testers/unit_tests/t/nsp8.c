#pragma optimize(struct_pointer)
auto device message1;
struct pt { int a; int b; };
register struct pt s1, s2;
void main() {
    struct pt *byname p = &s1;
    p->a = 1;
    p = &s2;
    p->a = 2;
    print(s1.a);
    print(s2.a);
    printflush(message1);
}
