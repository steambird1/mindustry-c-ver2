/* while loop with a constant condition, writing into an array. */
auto device message1;
void main() {
    int a[4] = {0, 0, 0, 0};
    int i = 0;
    while (i < 4) {
        a[i] = i + 100;
        i = i + 1;
    }
    print(a[0]);
    print(a[3]);
    printflush(message1);
    stop();
}
