auto device message1;
volatile int vc;
int *qq = &vc;
void main() {
    (*qq) = 7;
    print(vc);
    printflush(message1);
}
