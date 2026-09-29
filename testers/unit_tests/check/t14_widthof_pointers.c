/* EXPECT: 2 2 2 1 1 1 */
/* A pointer is two registers (block + offset) unless the level carries the
   name representation: `*byname` / `*byvaluename` keep only the one name
   word, on whatever level of the chain it is written. A pointer to a struct
   is always the two-word memory pointer. */
struct pt { int x; };
auto device message1;
void main() {
    print(widthof(int *));
    print(widthof(int **));
    print(widthof(struct pt *));
    print(widthof(int *byname));
    print(widthof(int *byvaluename));
    print(widthof(int **byname));
    printflush(message1); stop();
}