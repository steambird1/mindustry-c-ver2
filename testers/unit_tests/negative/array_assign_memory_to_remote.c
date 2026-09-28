/* Must fail: a MEMORY array cannot be assigned to a remote array.
   A remote array's elements are registers of ANOTHER processor, so reaching
   them means addressing a building that is not linked here. A memory array is
   a block and an offset in a building of this one. There is no instruction
   that turns the second into the first, and no address a remote array could
   take over -- so the two are not the same type, whatever `int[4]` says about
   either of them.

   (A handle would not help either: it packs the get / set helpers by LINE
   NUMBER in this program, and the same number means something else on another
   processor. Sharing the elements would mean sharing the code that reaches
   them.) */
extern int r[4] = {1, 2, 3, 4};
remote int ra[4] = remote(@this, r);
int mem[4];
/* MESSAGE: Cannot assign an array in memory to a remote array */
/* MESSAGE: are not the same type */
void main() {
    mem[0] = 1;
    ra = mem;
}
