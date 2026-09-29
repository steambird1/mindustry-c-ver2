/* EXPECT: 1 2 2 1 */
/* A small struct kept in registers is one word; the same struct forced into
   memory (volatile) occupies two -- a block/offset pair, like a pointer.
   A pointer to a struct is always the two-word memory pointer. */
struct pt { int x; };
auto device message1;
void main() {
    print(widthof(struct pt));
    print(widthof(volatile struct pt));
    print(widthof(struct pt *));
    print(widthof(register struct pt));
    printflush(message1); stop();
}