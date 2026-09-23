/* Peterson (filter algorithm), process 1 of 3 (a peer). */
auto device processor0;
auto device processor2;
auto device message1;

int lvl1[1] = array("embedded_divided", {0});
remote int lv0[1] = remote(processor0, lvl0, "embedded_divided");
remote int lv2[1] = remote(processor2, lvl2, "embedded_divided");
remote int turn[3] = remote(processor0, turn, "embedded_divided");
int entered1 = 0;
int scratch1 = 0;
remote int owner = remote(processor0, owner);
remote int violations = remote(processor0, violations);
remote int done1 = remote(processor0, done1);

void main() {
    int round;
    int l;
    int d;
    for (round = 0; round < 3; round++) {
        for (l = 1; l <= 2; l++) {
            lvl1[0] = l;
            turn[l] = 1;
            while (turn[l] == 1 && (lv0[0] >= l || lv2[0] >= l)) {
                scratch1 = scratch1 + 1;
            }
        }
        /* critical section */
        owner = 1;
        for (d = 0; d < 4; d++) scratch1 = scratch1 + 1;
        if (owner != 1) violations = 1;
        entered1 = entered1 + 1;
        lvl1[0] = 0;
    }
    done1 = 1;
    printflush(message1);
}
