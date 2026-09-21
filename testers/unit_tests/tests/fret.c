auto device message1;
int arr[4];
int* find(int i) { return arr + i; }
void nothing(int x) { }
void main() {
    arr[1] = 42;
    int* p = find(1);
    print(*p);
    nothing(1);
    printflush(message1);
    stop();
}
