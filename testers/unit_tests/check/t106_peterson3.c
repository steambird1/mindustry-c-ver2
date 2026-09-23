/* EXPECT: 3 3 3 0 */
/* The generalised (N-process) Peterson algorithm -- the `level` / `turn` filter
   algorithm -- between three real processors running CONCURRENTLY (// INTERLEAVE),
   entirely over remote variables:

     - `level[i]` is written by process i only, so each one lives on its own
       processor and the other two read it as a REMOTE ARRAY;
     - `turn[l]` is written by all of them, so it lives here and the others write
       it remotely;
     - `owner` / `violations` / `done` are shared the same way.

   A process claims `owner` on entry and checks it still owns it after a little
   work, which is what catches two processes being inside at once. */
// PEER: processor1=peers/t106_peterson3_p1.c, processor2=peers/t106_peterson3_p2.c
// SELF: processor0
// INTERLEAVE
/* Peterson (filter algorithm), process 0 of 3 -- the main program. It owns
   `turn`; every other process writes it remotely. */
auto device processor1;
auto device processor2;
auto device message1;

int lvl0[1] = array("embedded_divided", {0});
remote int lv1[1] = remote(processor1, lvl1, "embedded_divided");
remote int lv2[1] = remote(processor2, lvl2, "embedded_divided");
int turn[3] = array("embedded_divided", {0, 0, 0});
int entered0 = 0;
int scratch0 = 0;
remote int entered1 = remote(processor1, entered1);
remote int entered2 = remote(processor2, entered2);
int owner = 0;
int violations = 0;
int done1 = 0;
int done2 = 0;

void main() {
    int round;
    int l;
    int d;
    for (round = 0; round < 3; round++) {
        for (l = 1; l <= 2; l++) {
            lvl0[0] = l;
            turn[l] = 0;
            while (turn[l] == 0 && (lv1[0] >= l || lv2[0] >= l)) {
                scratch0 = scratch0 + 1;
            }
        }
        /* critical section */
        owner = 0;
        for (d = 0; d < 4; d++) scratch0 = scratch0 + 1;
        if (owner != 0) violations = 1;
        entered0 = entered0 + 1;
        lvl0[0] = 0;
    }
    while (done1 == 0 || done2 == 0) {
        scratch0 = scratch0 + 1;
    }
    print(entered0);
    print(entered1);
    print(entered2);
    print(violations);
    printflush(message1);
    stop();
}
