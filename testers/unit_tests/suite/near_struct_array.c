auto device message1;
struct pt { int x; int y; };
near struct pt np[2];
void main() {
    np[0].x = 11; np[1].y = 22;
    print(np[0].x); print(np[1].y);
    printflush(message1); stop();
}
