#pragma optimize(pointer)
auto device message1;
void main() {
    int x = 5;
    int* p = &x;
    *p = 7;
    int y = *p;
    int* q = p;
    print(y);
    print(*q);
    printflush(message1);
    stop();
}
