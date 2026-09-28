/* EXPECT: 8 */
/* A `byname` PARAMETER: the callee stores a name, so the caller passes the
   name of w and w never needs an address. */
auto device message1;
void set8(int *byname p) { (*p) = 8; }
void main() {
    int w = 1;
    set8(&w);
    print(w);
    printflush(message1);
}
