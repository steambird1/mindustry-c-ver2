/*
A pointer member is two fixed registers, so a name packet can name its block
and pos separately. `q->p` reconstructs a normal pointer; `q->x` remains a
single name leaf.
*/
/* EXPECT: 9 3 */
/* EMIT: set [^ ]*q\.p_block "g:\.s\.__pointer\.p_block" */
/* EMIT: set [^ ]*q\.p_pos "g:\.s\.__pointer\.p_pos" */
auto device message1;
struct S { int *p; int x; };
S s;
int v = 9;

void main() {
    S *byname q = byname(&s);
    q->p = &v;
    q->x = 3;
    print(*q->p);
    print(q->x);
    printflush(message1);
    stop();
}
