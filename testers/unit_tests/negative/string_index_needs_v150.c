/* MESSAGE: String index access requires at least v150 */
/* VERSION: 149 */
/* Reading a character out of a native string is a v150 instruction. On an
   older target the compiler refuses the subscript instead of emitting a
   `read` the game cannot execute. */
auto device message1;
void main() {
    string_t s = "hi";
    print(s[0]);
    printflush(message1);
    stop();
}
