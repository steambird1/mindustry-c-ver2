auto device message1;
void main() {
    int a[4] = {1, 2, 3, 4};
    a[1] = 99;             /* invalidates the constant array */
    print(a[1]);
    print(a[2]);
    printflush(message1);
    stop();
}
