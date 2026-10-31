/* EXPECT: hello abcd */
/* String literals joined at compile time, and a native string variable whose value is known is folded too. */
auto device message1;
void main() {
    string_t s = "hello";
    print(s);
    print("ab" + "cd");
    printflush(message1); stop();
}
