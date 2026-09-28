/* EXPECT: 5 */
/* No memory block is linked (see the `nomem` suite runner), so a pointer has
   nothing to point AT: `int *byname q` asks for the name representation
   explicitly, which needs no memory at all, and w stays a plain register. */
auto device message1;
void main() {
    int w = 3;
    int *byname q;
    q = &w;
    (*q) = 5;
    print(w);
    printflush(message1);
}
