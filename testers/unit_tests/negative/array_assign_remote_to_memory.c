/* Must fail: a REMOTE array cannot be assigned to a memory array.
   The other direction of `array_assign_memory_to_remote`, and refused for the
   same reason. It is worth having as its own case: the two sides are named in
   the message, so a check that only ever looked at one of them would pass the
   first case and fail this one. */
/* MESSAGE: Cannot assign a remote array to an array in memory */
extern int r[4] = {1, 2, 3, 4};
remote int ra[4] = remote(@this, r);
int mem[4];
void main() {
    r[0] = 1;
    mem = ra;
}
