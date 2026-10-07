/* #pragma stackcheck(fn): call fn, then leave the frame allocation. */
/* KNOWN-GAP: traps on the next frame allocation after an overflow: the handler returns
   with `__stackframe_block` left at -1, the next `getlink` on it yields
   null, and the walker reads through it. Defect: docs/OPEN_WORK.md 3.3.
*/
#pragma stackcheck(onOverflow)
auto device message1;
void onOverflow() {
    print(999);
    printflush(message1);
}
int rec(int n) {
    int big[8];
    big[0] = n;
    if (n <= 0) return 0;
    return big[0] + rec(n - 1);
}
void main() {
    print(rec(5));
    printflush(message1);
    stop();
}
