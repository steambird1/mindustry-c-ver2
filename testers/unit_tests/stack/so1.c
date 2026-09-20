/* Default: on stack overflow write a fixed message to __error and stop. */
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
