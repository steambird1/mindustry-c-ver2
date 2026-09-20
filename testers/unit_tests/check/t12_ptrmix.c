/* EXPECT: 15 5 9 */
auto device message1;
void main() {
    int a[3] = {4, 5, 6};
    int* p = a;
    int s = *p;
    p = p + 1;
    s = s + *p;
    p = p + 1;
    s = s + *p;
    print(s);
    int x = 5;
    int* q = &x;
    print(*q);
    int y = *q + 4;
    print(y);
    printflush(message1);
    stop();
}
