/* Must fail: a remote array cannot be bound to a handle.
   A handle is not a pointer to the elements -- it packs the get and set HELPER
   entry points, and those are line numbers in THIS program's own output. On
   another processor they are line numbers of whatever that processor happens to
   be running, so the handle would reach the wrong code rather than fail.

   The wording has to say that, because "copy the elements instead" is the whole
   of the advice: a remote array can be read element by element, it just cannot
   be NAMED. It is worth having as its own case: the two sides are named in the
   message, so a check that only ever looked at one of them would pass
   `array_assign_memory_to_remote` and fail this one. */
/* MESSAGE: Cannot bind a remote array to 'a': a handle packs helper entry points  */
extern int r[4] = {1, 2, 3, 4};
remote int ra[4] = remote(@this, r);
int a[];
void main() {
    a = ra;
}
