/*
No memory block: a flat registry-struct array automatically uses the register
layout and keeps its members in `<array>_<i>.<member>` registers.
*/
/* EXPECT: 3 2 4 */
auto device message1;

struct P { int x; int y; };
struct P a[2] = {{1, 2}, {3, 4}};

void main() {
    print(a[1].x);
    print(a[0].y);
    a[0] = a[1];
    print(a[0].y);
    printflush(message1);
    stop();
}
