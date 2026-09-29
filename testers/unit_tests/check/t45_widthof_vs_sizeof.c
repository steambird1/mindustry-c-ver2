/* EXPECT: 1 4 2 1 1 */
/* sizeof counts the memory CELLS a value occupies; widthof counts REGISTERS.
   A memory array of 4 ints is 4 cells but 2 words -- the two questions
   answer different things and must not be confused. */
struct pt { int x; };
auto device message1;
void main() {
    print(sizeof(int));
    print(sizeof(int[4]));
    print(widthof(int[4]));
    print(widthof(int *byname));
    print(sizeof(struct pt));
    printflush(message1); stop();
}