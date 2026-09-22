// PEER: processor1=remPtr.peer.c
/* `remote(processor1, qq)`: the pointer lives on the other processor. It need
   not be declared here at all -- its name is all that is needed. */
auto device processor1;
auto device message1;
int *remote q = remote(processor1, qq);
void main() {
    (*q) = 33;
    print(*q);
    printflush(message1);
}
