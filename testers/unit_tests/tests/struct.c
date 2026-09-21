auto device message1;
struct pt { int x; int y; };
void main() {
    struct pt p;
    p.x = 4;
    p.y = 5;
    print(p.x + p.y);
    printflush(message1);
    stop();
}
