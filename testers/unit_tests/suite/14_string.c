/* string_t means STRING here; s[i] reads the ASCII code of one character. */
auto device message1;
volatile int vi;

void main() {
    string_t s = "hello";
    int i = vi;
    print(s[i]);
    print(s[0]);
    printflush(message1);
    stop();
}
