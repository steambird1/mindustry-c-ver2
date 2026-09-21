auto device message1;
void main() {
    int x = 0;
    while (true) {
        x = x + 1;
        if (x > 250) { break; }
    }
    print(x);
    printflush(message1);
    stop();
}
