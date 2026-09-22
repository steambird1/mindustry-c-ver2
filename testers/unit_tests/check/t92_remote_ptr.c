/* EXPECT: 33 */
/* `int *remote q`: the pointer ITSELF lives in the other processor, so it is
   read back as the pair q_block / q_pos and then used here like a normal
   memory pointer. That needs a peer that really owns it -- see // PEER. */
// PEER: processor1=peers/t92.peer.c
auto device processor1;
auto device message1;
int *remote q = remote(processor1, "g:.qq");
void main() {
    (*q) = 33;
    print(*q);
    printflush(message1);
}
