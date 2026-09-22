/* EXPECT: 1 2 7 99 30 1 */
/* Everything remote at once: a scalar, an array and a struct pointer, all
   pointing at this very processor so the result can be checked. */
#pragma optimize(struct_pointer)
auto device message1;
extern int c;
struct pt { int x; int y; };
register struct pt st;
int u[4] = {10, 20, 30, 40};
remote int rc = remote(@this, c);
remote int ru[] = remote(@this, u);
void main() {
    remote struct pt *p = remote(@this, &st);
    p->x = 1; p->y = 2;
    rc = 7;
    ru[0] = 99;
    print(st.x);
    print(st.y);
    print(c);
    print(u[0]);
    print(ru[2]);
    print(p->x);
    printflush(message1);
}
