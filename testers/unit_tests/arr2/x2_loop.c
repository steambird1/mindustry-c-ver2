/* Array built inside a for loop with constant bounds. */
auto device message1;
void main() {
    int a[4];
    int i;
    for (i = 0; i < 4; i++) {
        a[i] = i * i;
    }
    print(a[2]);   /* 4 */
    print(a[3]);   /* 9 */
    printflush(message1);
    stop();
}
