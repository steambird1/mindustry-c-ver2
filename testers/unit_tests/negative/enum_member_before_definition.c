/* MESSAGE: Unknown member type 'Color' */
/* An enum tag must be declared before a struct member uses it. */
auto device message1;
struct S { enum Color c; };
enum Color { RED, GREEN, BLUE };
void main() {
    printflush(message1);
    stop();
}
