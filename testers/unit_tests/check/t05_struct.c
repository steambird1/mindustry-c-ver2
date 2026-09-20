/* EXPECT: 9 4 9 */
auto device message1;
struct point { int x; int y; };
int sumpoint(struct point* p) { return p->x + p->y; }
void main() {
    struct point p;
    p.x = 4;
    p.y = 5;
    print(p.x + p.y);
    struct point q;
    q = p;
    q.x = 0;
    print(p.x);
    print(sumpoint(&p));
    printflush(message1);
    stop();
}
