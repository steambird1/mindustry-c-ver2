/* EXPECT: 6 */
/* near struct containing an array, recursive */
auto device message1;
struct box { int n; int data[3]; };
int rec(int n) {
    near struct box b;
    b.n = n;
    b.data[0] = n;
    if (n <= 0) return 0;
    return b.n + rec(n - 1);
}
void main() {
    print(rec(3));
    printflush(message1);
    stop();
}
