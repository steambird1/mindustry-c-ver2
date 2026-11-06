/*
A shared pointer member keeps a building in registers and a program-level
stable id in memory. Direct struct access reads the building directly; the
shared-struct path must serialize the target as a stable id, not a local link
index.
*/
/* EXPECT: 2 5 3 3 7 7 */
/* EMIT: set [^ ]*s\.p_block bank1 */
/* EMIT: read [^ ]+ g:\.s\.p_block [^ ]+ */
/* EMIT: write 1 __curb [^ ]+ */
/* EMIT-NOT: write bank1_id __curb */
auto device message1;
struct S { shared int *p; int x; };
int data[4] = {1, 2, 3, 4};
S s;
S t;
shared S *q = &t;

void main() {
    s.p = &data[1];
    s.x = 5;
    print(*s.p);
    print(s.x);

    q->p = &data[2];
    q->x = 7;
    print(*q->p);
    print(*t.p);
    print(q->x);
    print(t.x);

    printflush(message1);
    stop();
}
