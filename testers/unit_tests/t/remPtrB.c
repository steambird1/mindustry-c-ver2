// PEER: processor1=remPtrB2.peer.c
auto device processor1;
auto device message1;
volatile int vc2;
int *remote q = remote(processor1, qq2);
void main() {
    print(*q);
    printflush(message1);
}
