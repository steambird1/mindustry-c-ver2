/*
Storing a LOCAL name pointer into a real remote struct's `byname` member is a
device mismatch. `#pragma checkRemote(fail)` calls the handler, which reports
and the program stops before the following print.
*/
// PEER: processor1=peers/t246.peer.c
/* EXPECT: 99 */
#pragma checkRemote(fail)
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

void fail() {
    print(99);
    printflush(message1);
}

void main() {
    r[0].p = byname(&x);
    print(1);
    printflush(message1);
    stop();
}
