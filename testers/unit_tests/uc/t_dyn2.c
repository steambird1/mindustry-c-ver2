auto device message1;
int n;
void main() {
    int i = 0, s = 0;
    n = 300;
    while (i < n) { s = s + 1; i = i + 1; }
    print(s);
    printflush(message1);
    stop();
}
