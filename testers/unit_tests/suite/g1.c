auto device message1;
int g = 5;
void main() {
    int total = 1, i;
    for (i = 0; i < g; i++) { total += i; }
    print(total);
    printflush(message1);
    stop();
}
