/* EXPECT: 42 */
/* No memory block is linked (see the `nomem` suite runner).

   `int *byname remote q` is ONE name register on the other side, and the write
   goes through that name (`write 42 @this g:.c`), so no block/pos pair is ever
   formed -- neither for the pointer nor for its target. A program that reaches
   nothing but another processor needs no memory of its own, and reporting the
   pointer as missing one refused a program that was already correct. */
auto device message1;
extern int c;
extern string_t qq;
void main() {
    qq = "g:.c";
    int *byname remote q = remote(@this, "g:.qq");
    (*q) = 42;
    print(c);
    printflush(message1);
}
