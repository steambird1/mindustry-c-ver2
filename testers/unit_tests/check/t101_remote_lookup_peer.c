/* EXPECT: 2 9 */
/* A remote lookup array on a REAL other processor: no register of that name is
   declared by this program, only by the peer -- see // PEER. */
// PEER: processor1=peers/t101.peer.c
auto device processor1;
auto device message1;
remote int ru[4] = remote(processor1, "g:.u", "embedded_lookup_item");
void main() {
    print(ru[1]);
    ru[1] = 9;
    print(ru[1]);
    printflush(message1); stop();
}
