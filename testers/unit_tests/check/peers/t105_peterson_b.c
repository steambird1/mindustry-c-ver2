/* Peterson, process 1 of 2 (the peer). It owns `levelB`, `enteredB` and
   `doneB`; everything shared that it does not own -- `turn`, `levelA`,
   `owner`, `violations`, `done` -- it reaches remotely on the other processor. */
auto device processorA;
auto device message1;

int levelB[1] = array("embedded_divided", {0});
remote int lvlA[1] = remote(processorA, levelA, "embedded_divided");
remote int turn[2] = remote(processorA, turn, "embedded_divided");

int enteredB = 0;
extern int doneB;
extern int scratchB;

remote int owner = remote(processorA, owner);
remote int violations = remote(processorA, violations);
remote int done = remote(processorA, done);

/* i = 1, N = 2, so there is a single level l = 1 */
void main() {
    int round;
    int d;
    for (round = 0; round < 3; round++) {
        levelB[0] = 1;
        turn[1] = 1;
        while (turn[1] == 1 && lvlA[0] >= 1) {
            scratchB = scratchB + 1;
        }
        /* critical section */
        owner = 1;
        for (d = 0; d < 4; d++) scratchB = scratchB + 1;
        if (owner != 1) violations = 1;
        enteredB = enteredB + 1;
        levelB[0] = 0;
    }
    doneB = 1;
    done = 1;
    printflush(message1);
}
