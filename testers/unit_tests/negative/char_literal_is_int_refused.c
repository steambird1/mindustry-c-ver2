/* MESSAGE: Cannot initialize 'char' with 'int' */
/* docs/OPEN_WORK.md 7.1: `'x'` is an `int` holding the ASCII code, so giving
   one to a `char` is the ordinary `int` -> `char` refusal: a clean one-line
   message, and neither the generator crash (`raw` was lost) nor the runtime
   trap of 3.1. The double-quoted "a" remains the way to make a char
   literal. */
auto device message1;
void main() {
    char c = 'x';
    printflush(message1);
    stop();
}