/* Peterson, process 1 of 2 (the peer). It owns `levelB`, `enteredB`, `doneB`;
   everything shared that it does not own -- the other process's level, `turn`,
   `owner`, `violations`, `done` -- it reaches remotely on processorA.

   The entry protocol is the same `auto` source as in the main program, and here
   it is instantiated differently: `lvl` is this program's own register array
   while `turn` and `other` are remote. */
#pragma overload(auto)
auto device processorA;
auto device message1;

int levelB[1] = array("embedded_divided", {0});
remote int lvlA[1] = remote(processorA, levelA, "embedded_divided");
remote int turn[2] = remote(processorA, turn, "embedded_divided");

int enteredB = 0;
extern int scratchB;
remote int owner = remote(processorA, owner);
remote int violations = remote(processorA, violations);
remote int done = remote(processorA, done);

void enter(auto int lvl[1], auto int turn[2], auto int other[1], int me, int l) {
    lvl[0] = l;
    turn[l] = me;
    while (turn[l] == me && other[0] >= l) {
        scratchB = scratchB + 1;
    }
}

/* i = 1, N = 2, so there is a single level l = 1 */
void main() {
    int round;
    int d;
    for (round = 0; round < 3; round++) {
        enter(levelB, turn, lvlA, 1, 1);
        /* critical section */
        owner = 1;
        for (d = 0; d < 4; d++) scratchB = scratchB + 1;
        if (owner != 1) violations = 1;
        enteredB = enteredB + 1;
        levelB[0] = 0;
    }
    done = 1;
    printflush(message1);
}
