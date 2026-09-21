auto device message1;
void main() {
    int a = 3, b = 2, i = 0, t = 0;
    int lim = a * b + 1;
    while (i < lim) { t = t + i * 2; i = i + 1; }
    print(t);
    printflush(message1);
    stop();
}
