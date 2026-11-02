/*
A multidimensional register array may hold flat registry structs. Each
element's members are registers named `<array>_<flatIndex>.<member>`.
*/
/* EXPECT: 5 4 2 8 */
struct P { int x; int y; };

struct P a[2][2] = array("embedded_divided",
    {{{1, 2}, {3, 4}}, {{5, 6}, {7, 8}}});

auto device message1;

void main() {
    print(a[1][0].x);
    print(a[0][1].y);
    print(lenof(a));
    print(sizeof(a));
    printflush(message1);
    stop();
}
