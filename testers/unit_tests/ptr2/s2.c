auto device message1;
struct point { int x; int y; };
void main() {
    struct point p;
    p.x = 4; p.y = 5;
    struct point q;
    q = p;
    print(q.x);
    printflush(message1);
    stop();
}
