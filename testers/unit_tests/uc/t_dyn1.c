auto device message1;
int n;
void main() {
    int i = 0, s = 0;
    n = 5;
    while (i < n) { s = s + i; i = i + 1; }
    print(s);
    printflush(message1);
    stop();
}
