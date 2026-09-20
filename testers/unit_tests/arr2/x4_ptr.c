/* Once the array is handed to a pointer it can be written through p[anything]. */
auto device message1;
void main() {
    int a[4] = {1, 2, 3, 4};
    int* p = a;
    p[1] = 77;
    print(a[1]);
    printflush(message1);
    stop();
}
