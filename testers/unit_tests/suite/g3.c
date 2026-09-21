auto device message1;
void main() {
    int a = 3, b = 2, sum = a + b, total = 1, i = 0;
    while (i < sum) { total += i; i = i + 1; }
    print(total);
    printflush(message1);
    stop();
}
