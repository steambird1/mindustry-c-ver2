auto device message1;
void main() {
    int i = 0, c = 0, n = 4;
    while (i < n) {
        i = i + 1;
        if (i == 2) { c = c + 100; } else { c = c + 1; }
    }
    print(c);
    printflush(message1);
    stop();
}
