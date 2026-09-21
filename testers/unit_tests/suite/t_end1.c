auto device message1;
void main() {
    int x = 0, c = 0;
    while (true) {
        x = x + 1;
        c = c + x;
        if (x >= 4) { break; }
    }
    print(c);
    printflush(message1);
    stop();
}
