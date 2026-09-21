#pragma optimize(pointer)
auto device message1;
int arr[4];
void main() {
    int x = 5;
    int* p = arr;
    int* q = &x;
    q = q + 1;
    int* r = &x;
    print(r[0]);
    printflush(message1);
    stop();
}
