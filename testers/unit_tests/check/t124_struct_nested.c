/* EXPECT: 1 2 9 */
/* A struct INSIDE a struct, plus a struct holding a pointer and one holding an
   array, all reached through pointers. */
auto device message1;
struct pair { int x; int y; };
struct holder { struct pair p; struct pair q; };
struct withptr { int v; int *link; };
struct witharr { int data[3]; int n; };
struct holder h;
struct withptr a; struct withptr bb;
struct witharr bx;
void main() {
    struct holder *w = &h;
    w->p.x = 1; w->q.y = 2;
    a.v = 1; bb.v = 9;
    a.link = &bb.v;
    struct witharr *bp = &bx;
    bp->data[1] = 5;
    bp->n = 4;
    print(h.p.x); print(h.q.y);
    print(*(a.link));
    printflush(message1); stop();
}
