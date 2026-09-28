/* EXPECT: 8 */
/* A `byname` parameter carries the name through the call, so the target needs
   no memory either. */
auto device message1;
void set8(int *byname p) { (*p) = 8; }
void main() {
    int w = 1;
    set8(&w);
    print(w);
    printflush(message1);
}
