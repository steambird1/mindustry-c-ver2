/*
A remote struct array on a REAL other processor. Each element is addressed by
its per-leaf names: scalar members, bitfield storage cells and a byname member.
*/
// PEER: processor1=peers/t246.peer.c
/* EXPECT: 4 1 7 9 */
auto device processor1;
auto device message1;

struct S {
    int x;
    int y;
    int a:3;
    int b:4;
    int *byname p;
};

remote struct S r[2] = remote(processor1, u, "embedded_divided");

void main() {
    print(r[1].x);
    print(r[1].a);
    print(*r[0].p);
    r[1].b = 9;
    print(r[1].b);
    printflush(message1);
    stop();
}
