auto device message1;
struct point { int x; int y; };
void main() {
    struct point p;
    p.x = 4;
    int* px = &p.x;
    *px = 9;
    print(p.x);
    printflush(message1);
    stop();
}
