/* EXPECT: 1 1 2 1 */
/* Storage qualifiers (near, const, volatile) say where a variable LIVES, not
   how wide it is: only the representation (name pointer, handle, memory
   pair) changes the width. volatile on an int is still a 1-word int. */
auto device message1;
void main() {
    print(widthof(near int));
    print(widthof(const int));
    print(widthof(volatile int *));
    print(widthof(volatile int));
    printflush(message1); stop();
}