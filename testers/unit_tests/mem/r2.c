#pragma optimize(pointer)
auto device message1;
int rec(int n) {
    int local[4];
    int x = n;
    int* p = &x;
    local[0] = *p;
    if (n <= 0) {
        return local[0];
    }
    return local[0] + rec(n - 1);
}
void main() {
    print(rec(3));
    printflush(message1);
    stop();
}
