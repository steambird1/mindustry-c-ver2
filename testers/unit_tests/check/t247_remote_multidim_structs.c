/*
Multidimensional remote struct arrays: nested subscripts flatten to the same
flat element index, constant and dynamic member access work, and whole-element
reads/writes copy every storage leaf.
*/
/* EXPECT: 5 6 9 3 4 7 2 */
auto device message1;

struct S { int x; int y; };

struct S u[2][2] = array("embedded_divided",
    {{{1, 2}, {3, 4}}, {{5, 6}, {7, 8}}});
remote struct S r[2][2] = remote(@this, u);

void main() {
    print(r[1][0].x);

    int i = 1;
    int j = 0;
    print(r[i][j].y);

    r[i][j].x = 9;
    print(u[1][0].x);

    struct S s = r[0][1];
    print(s.x);
    print(s.y);

    r[0][0] = r[1][1];
    print(u[0][0].x);

    print(lenof(r));
    printflush(message1);
    stop();
}
