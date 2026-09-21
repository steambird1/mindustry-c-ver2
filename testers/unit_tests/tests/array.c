auto device message1;
int arr[8];
void main() {
    int i = 0;
    while (i < 8) {
        arr[i] = i * 2;
        i = i + 1;
    }
    print(arr[3]);
    printflush(message1);
    stop();
}
