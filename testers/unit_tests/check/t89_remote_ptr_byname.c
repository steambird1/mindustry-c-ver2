/* EXPECT: 42 */
/* `int *byname remote q`: over there the pointer is ONE name register, not a
   block/pos pair, so one read fetches it. */
auto device message1;
extern int c;
extern char qq;
void main() {
    qq = "g:.c";
    int *byname remote q = remote(@this, "g:.qq");
    (*q) = 42;
    print(c);
    printflush(message1);
}
