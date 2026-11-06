/*
A shared pointer to a fixed memory-layout struct/union carries the aggregate's
building alias, so member access stays on the direct `read/write building pos`
path. Large struct arrays are covered separately; this case is one complete
aggregate.
*/
/* EXPECT: 7 5 4 */
/* EMIT: set g:\.f:main\.b:1\.p_block bank1 */
/* EMIT: set g:\.f:main\.b:1\.q_block bank1 */
/* EMIT-NOT: getlink __curb */
auto device message1;
struct Big { int a[8]; int x; };
union U { int a; float b; };
Big data;
U u;

void main() {
    shared Big *p = &data;
    p->x = 7;
    p->a[2] = 5;
    print(p->x);
    print(p->a[2]);

    shared U *q = &u;
    q->a = 4;
    print(q->a);

    printflush(message1);
    stop();
}
