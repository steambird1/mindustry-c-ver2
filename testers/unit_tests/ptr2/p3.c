auto device message1;
void main() {
    int a[3];
    a[0] = 4;
    int* p = &a[1];
    *p = 7;
    print(a[1]);
    printflush(message1);
    stop();
}
