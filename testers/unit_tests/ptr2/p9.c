auto device message1;
void main() {
    int x = 4;
    int* px = &x;
    *px += 1;
    print(x);
    printflush(message1);
    stop();
}
