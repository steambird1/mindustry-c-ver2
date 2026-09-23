/* EXPECT: 3 3 0 */
/* Peterson between two real processors (// INTERLEAVE), with the entry protocol
   written ONCE as an `auto` function:

       void enter(auto int lvl[1], auto int turn[2], auto int other[1], int me, int l)

   In this program `lvl` is a register array, `turn` another register array and
   `other` a REMOTE array; in the peer (`peers/t108_peterson_auto_b.c`) the very
   same source sees `lvl` as a register array, `turn` and `other` as remote ones.
   The three cannot share one representation -- a register array has no address
   while an in-memory one does -- so each call site picks its own version of
   `enter`. That is what `auto` is for.

   The point is that mutual exclusion still holds: each process claims the shared
   `owner` on entry and checks it after a little work, so an overlap is caught. */
// PEER: processorB=peers/t108_peterson_auto_b.c
// SELF: processorA
// INTERLEAVE
#pragma overload(auto)
auto device processorB;
auto device message1;

int levelA[1] = array("embedded_divided", {0});
remote int lvlB[1] = remote(processorB, levelB, "embedded_divided");
int turn[2] = array("embedded_divided", {0, 0});

int enteredA = 0;
remote int enteredB = remote(processorB, enteredB);
int owner = 0;
int violations = 0;
int done = 0;
int scratchA = 0;

void enter(auto int lvl[1], auto int turn[2], auto int other[1], int me, int l) {
    lvl[0] = l;
    turn[l] = me;
    while (turn[l] == me && other[0] >= l) {
        scratchA = scratchA + 1;
    }
}

/* i = 0, N = 2, so there is a single level l = 1 */
void main() {
    int round;
    int d;
    for (round = 0; round < 3; round++) {
        enter(levelA, turn, lvlB, 0, 1);
        /* critical section */
        owner = 0;
        for (d = 0; d < 4; d++) scratchA = scratchA + 1;
        if (owner != 0) violations = 1;
        enteredA = enteredA + 1;
        levelA[0] = 0;
    }
    while (done == 0) {
        scratchA = scratchA + 1;
    }
    print(enteredA);
    print(enteredB);
    print(violations);
    printflush(message1);
    stop();
}
