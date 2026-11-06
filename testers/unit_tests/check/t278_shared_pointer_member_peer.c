/*
Two processors share one memory block. The peer stores a shared pointer
member as (stableId, pos) inside a shared struct; the main processor resolves
the stable id back to its own bank1 and dereferences it. The handshake keeps
the struct stable until it has been read.
*/
/* EXPECT: 42 7 */
/* NO-INVARIANT */
// PEER: processorA=peers/t278.peer.c
// INTERLEAVE
auto device processorA;
auto device message1;
volatile int main_ready = 0;
volatile int peer_done = 0;
int shared_data[4];
struct S { shared int *p; int x; };
volatile struct S shared_state;
shared struct S *q = &shared_state;

void main() {
    main_ready = 1;
    while (!peer_done) wait(0);
    /*
    Take the same address shape as the peer (its `&shared_data[1]` allocates
    the array and its __pointer pair), so both programs place shared_state at
    the same memory offset.
    */
    int *keep = &shared_data[0];
    shared_data[0] = *keep;
    print(*q->p);
    print(q->x);
    printflush(message1);
    stop();
}
