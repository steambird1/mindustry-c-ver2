#pragma optimize(pointer)
auto device message1;
void main() {
    int x = 1;
    int* p = &x;
    int** pp = &p;     /* p is a name pointer, so this is fine */
    **pp = 9;
    print(x);
    print(**pp);
    printflush(message1);
    stop();
}
