/* #pragma stackcheck(): no overflow watch (no message, no handler); running out is
   the program's own contract violation, and the walker stops cleanly at the
   end of the chain instead of reading through the null link. */
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
