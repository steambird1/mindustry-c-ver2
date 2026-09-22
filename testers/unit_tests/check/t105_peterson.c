/* EXPECT: 3 3 0 */
/* Peterson's algorithm between two real processors, run CONCURRENTLY (see
   // INTERLEAVE), over remote variables:

     - `level[i]` is written by process i only, so each one lives on its own
       processor and is read from the other by a REMOTE ARRAY;
     - `turn[l]` is written by both, so it lives here and the peer writes it
       remotely;
     - `owner` / `violations` are shared the same way.

   The point of the test is that the mutual exclusion really holds: each
   process claims `owner` on entry and checks it still owns it after a little
   work, which catches an overlap. */
// PEER: processorB=peers/t105_peterson_b.c
// SELF: processorA
// INTERLEAVE
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

/* i = 0, N = 2, so there is a single level l = 1 */
void main() {
    int round;
    int d;
    for (round = 0; round < 3; round++) {
        levelA[0] = 1;
        turn[1] = 0;
        while (turn[1] == 0 && lvlB[0] >= 1) {
            scratchA = scratchA + 1;
        }
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
