/* EXPECT: 104 108 3 */
auto device message1;
void main() {
    char s = "hello";
    print(s[0]);
    print(s[2]);
    int i = 3;
    print(s[i] - 105);
    printflush(message1);
    stop();
}
