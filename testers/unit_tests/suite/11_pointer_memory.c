/* Pointer arithmetic and arrays: these must NOT use the name representation. */
#pragma optimize(pointer)
auto device message1;
volatile int vi;
int arr[6];

void main() {
    int k;
    for (k = 0; k < 6; k++) {
        arr[k] = k + 1;
    }
    int* p = arr;
    p = p + 2;
    print(*p);
    int i = vi;
    print(arr[i]);
    print(*(arr + 3));
    printflush(message1);
    stop();
}
