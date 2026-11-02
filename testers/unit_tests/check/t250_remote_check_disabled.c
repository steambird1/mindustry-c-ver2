/*
`#pragma checkRemote()` disables the runtime device check. The same local
byname store into a remote struct does not stop the program.
*/
// PEER: processor1=peers/t246.peer.c
/* EXPECT: 1 */
#pragma checkRemote()
auto device processor1;
auto device message1;

int x = 7;

struct S {
    int x;
    int y;
    int a:3;
    int b:4;
    int *byname p;
};

remote struct S r[2] = remote(processor1, u, "embedded_divided");

void main() {
    r[0].p = byname(&x);
    print(1);
    printflush(message1);
    stop();
}
