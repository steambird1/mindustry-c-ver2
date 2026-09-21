auto device message1;
struct pt { int x; int y; };
struct pt pts[3];
struct pt single;
int i;
void main() {
    pts[0].x = 10; pts[0].y = 20;
    pts[1].x = 30; pts[1].y = 40;
    pts[2].x = 50; pts[2].y = 60;
    single.x = 7; single.y = 8;
    print(pts[0].x); print(pts[1].y); print(pts[2].x);
    print(single.x); print(single.y);
    for (i = 0; i < 3; i++) { print(pts[i].x + pts[i].y); }
    printflush(message1); stop();
}
