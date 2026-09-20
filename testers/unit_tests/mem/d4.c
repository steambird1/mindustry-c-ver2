auto device message1;
struct pt { int x; int y; };
struct pt arr[3];
void main() {
    struct pt p;
    struct pt* q = &p;
    p.x = 1;
    arr[1].x = 2;
    print(q->x);
    print(arr[1].x);
    printflush(message1);
    stop();
}
