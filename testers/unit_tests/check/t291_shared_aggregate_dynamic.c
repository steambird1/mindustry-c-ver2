/*
A shared aggregate pointer keeps its fixed-storage building even when the
element index is only known at run time, and when the pointer travels through
a function return, a shared parameter and a shared memory slot.
*/
/* EXPECT: 7 5 7 */
/* EMIT: set __return_block bank1 */
/* EMIT-NOT: getlink __curb */
#pragma noinline(get)
#pragma noinline(put)
auto device message1;

typedef struct { int a[4]; int x; } Big;

Big data[2];
shared Big *volatile slot;

shared Big *get(int i) {
    return &data[i];
}

void put(shared Big *p) {
    slot = p;
}

void main() {
    shared Big *p = get(1);
    p->x = 7;
    p->a[2] = 5;
    print(p->x);
    print(p->a[2]);

    put(p);
    print(slot->x);

    printflush(message1);
    stop();
}
