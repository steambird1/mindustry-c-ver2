auto device message1;
volatile int v;
volatile int varr[4];
volatile int* pv;
int* volatile vp;
void main() {
    v = 3;
    print(v);
    varr[1] = 5;
    print(varr[1]);
    pv = &v;
    print(*pv);
    vp = &v;
    print(*vp);
    printflush(message1);
    stop();
}
