auto device message1;
struct pt { int x; int y; };
register struct pt st;
void main() {
    struct pt *p = &st;
    p->x = 5;
    print(st.x);
    printflush(message1);
}
