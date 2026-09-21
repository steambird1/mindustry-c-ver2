auto device message1;
int i = 0;
int more() { i = i + 1; return i < 5; }
void main() {
    int c = 0;
    while (more()) { c = c + 1; }
    print(c);
    printflush(message1);
    stop();
}
