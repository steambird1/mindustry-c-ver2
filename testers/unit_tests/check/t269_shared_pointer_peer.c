/*
Two real processors share one memory block. The peer writes a pointer into a
shared slot as (stableId, pos); the main processor reads it back, resolves the
stable id to its own bank1, and dereferences the pointer. The handshake keeps
the shared slot stable until it has been read.
*/
/* EXPECT: 42 */
/* NO-INVARIANT */
// PEER: processorA=peers/t269.peer.c
// INTERLEAVE
auto device processorA;
auto device message1;
volatile int main_ready = 0;
volatile int peer_done = 0;
int shared_data[4];
shared int *volatile shared_slot;

void main() {
    main_ready = 1;
    while (!peer_done) wait(0);
    /*
    Take the same address shape as the peer (its `&shared_data[1]` allocates
    the array's __pointer pair), so both programs place shared_slot at the
    same memory offset.
    */
    int *keep = &shared_data[0];
    shared_data[0] = *keep;
    print(*shared_slot);
    printflush(message1);
    stop();
}
