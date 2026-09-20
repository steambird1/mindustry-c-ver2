auto device message1;
struct point { int x; int y; };
void main() {
    struct point p;
    p.x = 4;
    int* px = &p.x;
    int v = *px;
    print(v);
    printflush(message1);
    stop();
}
