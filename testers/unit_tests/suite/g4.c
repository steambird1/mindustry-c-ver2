auto device message1;
int g;
void main() {
    int i;
    for (i = 0; i < 3; i++) { g += 1; }
    print(g);
    printflush(message1);
    stop();
}
