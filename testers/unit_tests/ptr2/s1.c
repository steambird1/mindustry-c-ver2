auto device message1;
struct point { int x; int y; };
int f(struct point* p) { return p->x + p->y; }
void main() {
    struct point p;
    p.x = 4; p.y = 5;
    print(f(&p));
    printflush(message1);
    stop();
}
