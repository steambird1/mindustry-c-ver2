/* Constant folding together with if / else. */
auto device message1;
void main() {
    int a[4] = {10, 20, 30, 40};
    int r = 0;
    if (a[0] < a[3]) {
        r = a[1] + a[2];      /* 50 */
    } else {
        r = a[0] - a[3];
    }
    if (a[1] == 20) {
        r = r + a[3];         /* 90 */
    }
    print(r);
    printflush(message1);
    stop();
}
