auto device message1;
volatile int vg;
int g;
void main() {
    vg = 3;
    g = (volatile int)vg + 1;
    print(g);
    print((int)vg);
    printflush(message1);
    stop();
}
