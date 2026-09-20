/* EXPECT: 10 10 */
/* `near` array inside a recursive function: must never be split across blocks */
auto device message1;
int rec(int n) {
    near int buf[4];
    buf[0] = n;
    if (n <= 0) return 0;
    int r = rec(n - 1);
    return buf[0] + r;
}
void main() {
    print(rec(4));
    print(rec(4));
    printflush(message1);
    stop();
}
