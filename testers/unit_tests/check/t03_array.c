/* EXPECT: 15 7 12 34 */
auto device message1;
void main() {
    int a[5];
    int i;
    for (i = 0; i < 5; i++) {
        a[i] = i * 3;
    }
    print(a[2] + a[3]);
    a[1] = 7;
    print(a[1]);
    print(a[4]);
    int total = 0;
    for (i = 0; i < 5; i++) {
        total = total + a[i];
    }
    print(total);
    printflush(message1);
    stop();
}
