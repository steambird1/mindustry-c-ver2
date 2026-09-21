auto device message1;
int n;
int getn() { return 4; }
void main() {
    int total = 0, i;
    for (i = 0; i < getn(); i++) { total = total + i; }
    print(total);
    printflush(message1);
    stop();
}
