auto device message1;
int step() { return 2; }
void main() {
    int total = 0, i;
    for (i = 0; i < 6; i = i + step()) { total = total + i; }
    print(total);
    printflush(message1);
    stop();
}
