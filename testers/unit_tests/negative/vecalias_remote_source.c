/* Must fail: `vecalias` cannot name a remote array.

   A handle packs the get / set HELPER entry points, and those are line numbers
   in THIS program's own output. On another processor the same number is a
   line in whatever that processor happens to be running, so the handle would
   reach the wrong code rather than fail -- which is the worst of both.

   This is worth its own case rather than a remark on the remote rules
   elsewhere: the elements of a remote array CAN be copied, one at a time, and
   `veccpy` is the call that does it, so the message has to name the way out.
   A refusal that only said "no" would leave the reader thinking remote arrays
   are unusable. */
/* MESSAGE: Cannot bind a remote array by vecalias: a handle packs helper entry po */
/* MESSAGE: Copy the elements with 'veccpy' instead */
extern int r[4] = {1, 2, 3, 4};
remote int ra[4] = remote(@this, r);
int mem[4];
int a[];
void main() {
    a = mem;
    vecalias(&a, ra);
}
