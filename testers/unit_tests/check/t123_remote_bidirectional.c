/* EXPECT: 100 84 */
/* Two processors that each hold a `remote` handle on the other's variable:
   the peer publishes 100, the main program answers with 42, and the peer
   doubles it back to 84. Both directions go through `remote`, which is the only
   way to see a register that belongs to the other side.

   `ping` is `extern` because nothing in THIS program reads it -- the peer does,
   through `remote`. Without that the write would look dead and be deleted.
   Each side waits for what the other published, so the result does not depend
   on how the two are interleaved. */
// PEER: processor1=peers/t123.peer.c
// SELF: processorA
// INTERLEAVE
auto device processor1;
auto device message1;
extern int ping;
remote int rpong = remote(processor1, "g:.pong");
void main() {
    int guard = 0;
    while (rpong != 100 && guard < 500) { guard = guard + 1; }
    print(rpong);
    ping = 42;
    guard = 0;
    while (rpong != 84 && guard < 5000) { guard = guard + 1; }
    print(rpong);
    printflush(message1); stop();
}
