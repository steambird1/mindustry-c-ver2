auto device message1;
int g(int* q) { return *q; }
void main() {
    int x = 4;
    print(g(&x));
    printflush(message1);
    stop();
}
