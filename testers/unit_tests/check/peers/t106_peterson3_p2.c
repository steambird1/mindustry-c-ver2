/* Peterson (filter algorithm), process 2 of 3 (a peer). */
auto device processor0;
auto device processor1;
auto device message1;

int lvl2[1] = array("embedded_divided", {0});
remote int lv0[1] = remote(processor0, lvl0, "embedded_divided");
remote int lv1[1] = remote(processor1, lvl1, "embedded_divided");
remote int turn[3] = remote(processor0, turn, "embedded_divided");
int entered2 = 0;
int scratch2 = 0;
remote int owner = remote(processor0, owner);
remote int violations = remote(processor0, violations);
remote int done2 = remote(processor0, done2);

void main() {
    int round;
    int l;
    int d;
    for (round = 0; round < 3; round++) {
        for (l = 1; l <= 2; l++) {
            lvl2[0] = l;
            turn[l] = 2;
            while (turn[l] == 2 && (lv0[0] >= l || lv1[0] >= l)) {
                scratch2 = scratch2 + 1;
            }
        }
        /* critical section */
        owner = 2;
        for (d = 0; d < 4; d++) scratch2 = scratch2 + 1;
        if (owner != 2) violations = 1;
        entered2 = entered2 + 1;
        lvl2[0] = 0;
    }
    done2 = 1;
    printflush(message1);
}
