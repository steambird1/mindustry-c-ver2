auto device message1;
int g = 5;
volatile int vg;
static int sg;
void main() {
    vg = g + 1;
    sg = vg * 2;
    print(sg);
    printflush(message1);
    stop();
}
