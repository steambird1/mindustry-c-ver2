/* #pragma stackcheck(): no capacity check at all. */
/* KNOWN-GAP: traps when the stack runs out: `#pragma stackcheck()` emits no capacity
   guard, so the walker follows `next block = -1` off the chain and reads
   through a null link. Defect: docs/OPEN_WORK.md 3.3.
*/
#pragma stackcheck()
auto device message1;
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
