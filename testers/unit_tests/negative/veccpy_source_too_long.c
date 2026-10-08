/* Must fail: `veccpy` refuses a source longer than its destination when both
   lengths are written down in the program.

   `M > N` here is a mistake in the program, not a run time condition, so it is
   caught where the program is read: nothing is generated, and the copy cannot
   quietly stop short of the end and lose elements without saying so.

   That is the difference from a handle source, and the reason this is its own
   case. A handle carries its length in the packed value, so there is nothing to
   check here at all, and the loop copies the smaller of the two counts instead.
   Checking only the static case would pass a compiler that silently truncated
   every handle-sourced copy; checking only the dynamic one would pass a
   compiler that let `veccpy(a3, b8)` run eight elements past a three-element
   array. Both have to hold, so both are asked for -- the first here, the second
   in `check/t155_veccpy_clamps.c`.

   (Note what is NOT refused: a remote DESTINATION. Its elements are registers
   of another processor, which `veccpy` reaches one at a time quite happily --
   see `check/t156_veccpy_remote.c`. Element copies travel; only a NAME does
   not, which is why `vecalias` refuses what `veccpy` accepts.) */
/* MESSAGE: The second argument of veccpy has 8 element\(s\) in dimension 1, but the */
int src[8] = {1, 2, 3, 4, 5, 6, 7, 8};
void main() {
    int dst[3];
    veccpy(dst, src);
    /* The reversed pairing is fine, and asking for it keeps the check honest:
       a compiler that compared the two lengths the wrong way round would refuse
       this one, and would still refuse the case above. */
    veccpy(src, dst);
}
