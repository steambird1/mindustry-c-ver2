auto device message1;
void main() {
    int x = 4;
    int* px = &x;
    int t = *px + 1;
    print(t);
    printflush(message1);
    stop();
}
