auto device message1;
volatile int v;
volatile int w;
int* volatile vp;
volatile int* pv;
void main() {
    v = 1;
    w = 2;
    vp = &v;
    vp = &w;
    print(*vp);
    pv = &v;
    print(*pv);
    printflush(message1);
    stop();
}
