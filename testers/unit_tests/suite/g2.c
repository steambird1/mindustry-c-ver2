auto device message1;
const int N = 5;
void main() {
    int total = 1, i;
    for (i = 0; i < N; i++) { total += i; }
    print(total);
    printflush(message1);
    stop();
}
