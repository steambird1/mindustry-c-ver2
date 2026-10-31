/* MESSAGE: Cannot initialize 'char' with 'string_t' */
/* A double-quoted literal is a native `string_t`. `char` is one character
   NUMBER; use `char a[] = "..."` for a C character array, or `string_t` for
   the machine string value. */
auto device message1;
void main() {
    char c = "x";
    printflush(message1);
    stop();
}
