/*
A `near` object is promised to lie inside ONE memory block, so stepping to a
member or an element is a plain offset addition -- no block-chain walk. The
flag used to be lost when the object was read out of memory (MemPointerRet)
and when a stepped pointer was built, so a near struct's array member still
called `__pointerForward`.
*/
/* EXPECT: 1 2 7 */
/* EMIT-NOT: ___pointerForward */
auto device message1;

struct Box { int n; int data[3]; };
near struct Box b;
volatile int idx;

void main() {
    b.n = 1;
    b.data[0] = 2;

    idx = 1;
    b.data[idx] = 7;

    print(b.n);
    print(b.data[0]);
    print(b.data[1]);

    printflush(message1);
    stop();
}
