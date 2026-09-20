auto device message1;
void main() {
    int x = 4;
    int* px = &x;
    *px = *px + 1;
    print(x);
    print(*px);
    printflush(message1);
    stop();
}
