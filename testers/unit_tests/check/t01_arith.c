/* EXPECT: 15 -5 42 6 2 */
auto device message1;
int add(int a, int b) { return a + b; }
void main() {
    int x = 10, y = 5;
    print(add(x, y));
    print(y - x);
    print(x * 4 + 2);
    print(x / y * 3);
    print(x % 4);
    printflush(message1);
    stop();
}
