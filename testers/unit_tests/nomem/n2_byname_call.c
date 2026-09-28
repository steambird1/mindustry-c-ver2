/* EXPECT: 6 */
/* `byname(&w)` is the same request in call form, and it works with no memory
   block linked: the pointer holds the name of a register, not an address. */
auto device message1;
void main() {
    int w = 3;
    int *q;
    q = byname(&w);
    (*q) = 6;
    print(w);
    printflush(message1);
}
