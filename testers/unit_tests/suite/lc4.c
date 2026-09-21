auto device message1;
int twice(int x) { return x + x; }
void main() {
    int s = 0, i;
    for (i = 0; i < 4; i++) { s = s + twice(i); }
    print(s);
    printflush(message1);
    stop();
}
