/*
A `*byname` member stores the target's name in the packet's member slot.
Reading it reconstructs a name pointer, so `*q->p` follows the name instead of
treating the stored value as a block/offset pair.
*/
/* EXPECT: 9 3 8 */
/* EMIT: write "g:\.v" @this [^ ]*q\.p */
auto device message1;
struct S { int *byname p; int x; };
S s;
int v = 9;

void main() {
    S *byname q = byname(&s);
    q->p = byname(&v);
    q->x = 3;
    print(*q->p);
    print(q->x);
    *q->p = 8;
    print(*q->p);
    printflush(message1);
    stop();
}
