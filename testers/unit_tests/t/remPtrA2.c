auto device message1;
volatile int vc;
int *qq2 = &vc;
void main() {
    (*qq2) = 7;
    print(vc);
    printflush(message1);
}
