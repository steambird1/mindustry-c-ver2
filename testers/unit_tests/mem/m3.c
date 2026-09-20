#pragma optimize(pointer)
auto device message1;
int arr[4];
void main() {
    int x = 1;
    int* p = &x;
    int* q = arr;      /* from an array: p-style must be refused for q */
    int* r = &x;
    arr = r;           /* into an array: r must be refused too */
    print(*p);
    print(*q);
    printflush(message1);
    stop();
}
