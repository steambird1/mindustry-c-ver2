/* EXPECT: 7 7 8 2 */
auto device message1;
void main() {
    int x = 4;
    int* p = &x;
    *p = 7;
    print(x);
    print(*p);
    int y = *p + 1;
    print(y);
    int arr[3];
    arr[0] = 1;
    arr[1] = 2;
    arr[2] = 3;
    int* q = arr;
    q = q + 1;
    print(*q);
    printflush(message1);
    stop();
}
