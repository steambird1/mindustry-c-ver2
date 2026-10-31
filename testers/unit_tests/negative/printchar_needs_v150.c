/* MESSAGE: printchar requires v150 */
/* VERSION: 149 */
/* Character output is part of the v150 string/message instruction set. */
auto device message1;
void main() {
    printchar(65);
    printflush(message1);
    stop();
}
