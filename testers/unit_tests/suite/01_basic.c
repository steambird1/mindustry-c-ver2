/* Basic arithmetic, variables and output. */
auto device message1;

int add(int a, int b) {
    return a + b;
}

void main() {
    int x = 7;
    int y = add(x, 3);
    x += y;
    x /= 2;
    print(x);
    print(y);
    printflush(message1);
    stop();
}
