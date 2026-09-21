auto device message1;
int arr[10];
void main() {
    int* p = arr;
    p = p + 3;
    *p = 42;
    print(arr[3]);
    print(*(p - 1));
    printflush(message1);
    stop();
}
