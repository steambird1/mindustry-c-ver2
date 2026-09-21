/* EXPECT: hello abcd */
/* String literals joined at compile time, and a char variable whose value is known is folded too. */
auto device message1;
void main() {
    char s = "hello";
    print(s);
    print("ab" + "cd");
    printflush(message1); stop();
}
