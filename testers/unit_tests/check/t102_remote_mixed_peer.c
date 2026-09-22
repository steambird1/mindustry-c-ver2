/* EXPECT: 1 3 5 40 */
/* Everything remote at once, against a REAL other processor: a scalar, an array
   and a struct pointer. The struct pointer carries the name of every member
   plus the processor, so `p->x` is one remote read/write. */
// PEER: processor1=peers/t102.peer.c
#pragma optimize(struct_pointer)
auto device processor1;
auto device message1;
struct pt { int x; int y; };
remote int rc = remote(processor1, "g:.c");
remote int ru[5] = remote(processor1, "g:.u", "embedded_divided");
void main() {
    remote struct pt *p = remote(processor1, "g:.st");
    rc = 1;
    ru[2] = 3;
    p->x = 5;
    print(rc);
    print(ru[2]);
    print(p->x);
    print(ru[3]);
    printflush(message1); stop();
}
