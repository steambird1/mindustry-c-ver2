auto device message1;
int rec(int n) {
    int local[4];
    local[0] = n;
    if (n <= 0) return local[0];
    int r = rec(n - 1);
    return local[0] + r;
}
void main() {
    print(rec(3));
    printflush(message1);
    stop();
}
