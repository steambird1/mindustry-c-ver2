/* EXPECT: 13 3 6 */
/* A function containing a loop CAN be inlined: the body is re-analysed after
   the move, and a variable written by the loop is not folded. */
auto device message1;
int sumarr(int* p, int n) {
    int s = 0;
    int i = 0;
    while (i < n) { s = s + p[i]; i = i + 1; }
    return s;
}
int forsum(int n) {
    int s = 0;
    int k = 0;
    for (k = 0; k < n; k = k + 1) { s = s + k; }
    return s;
}
void main() {
    int arr[4] = {1, 2, 3};
    arr[3] = 7;
    print(sumarr(arr, 4));
    print(sumarr(arr, 2));
    print(forsum(4));
    printflush(message1);
    stop();
}
