/*
`veccpy` reads its source through whatever the source is. Here that is a
HANDLE, so the loop's bound cannot be a literal: the length lives in the packed
value and is a run time question. The count is taken out of the handle with the
same shift-and-mask `lenof(handle)` uses, and lowered to the destination's length
so the copy cannot run past its end.

The EMITs say the bound is computed, not written down: the shift and mask off the
cell, and a `min` against the destination's size.
*/
/* EXPECT: 1 2 3 4 5 0 */
/* EMIT: op shr [^ ]* g:\.h \d+ */
/* EMIT: op and [^ ]* [^ ]* 4095 */
/* EMIT: op min [^ ]* [^ ]* 6 */
auto device message1;
int dst[6];
int src[5] = {1, 2, 3, 4, 5};
int h[];
void main() {
    vecalias(&h, src);
    veccpy(dst, h);
    print(dst[0]);
    print(dst[1]);
    print(dst[2]);
    print(dst[3]);
    print(dst[4]);
    print(dst[5]);
    printflush(message1);
    stop();
}
