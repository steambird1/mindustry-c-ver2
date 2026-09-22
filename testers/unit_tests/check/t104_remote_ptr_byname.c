/* EXPECT: 33 */
/* `int *remote q = remote(processor1, qq)`: the pointer itself is stored over
   there, and nothing called `qq` has to be declared here -- the name is enough. */
// PEER: processor1=peers/t104.peer.c
auto device processor1;
auto device message1;
int *remote q = remote(processor1, qq);
void main() {
    (*q) = 33;
    print(*q);
    printflush(message1); stop();
}
