/* EXPECT: 1 1 1 1 1 1 */
/* widthof(<type>) answers how many REGISTERS a value of the type occupies.
   Every scalar -- whatever its kind, however it is qualified -- is one word.
   The fold must run at compile time: the generated program never mentions
   the widthof keyword again. */
/* EMIT-NOT: widthof */
auto device message1;
void main() {
    print(widthof(int));
    print(widthof(char));
    print(widthof(long));
    print(widthof(volatile int));
    print(widthof(bool));
    print(widthof(float));
    printflush(message1); stop();
}