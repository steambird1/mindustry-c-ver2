/* Must fail: pointer arithmetic walks memory, and a name is not an address.
   `p = p + 1` contradicts `int *byname p` explicitly, so the request cannot be
   satisfied and has to be reported rather than silently degraded. */
auto device message1;
void main() {
    int w = 1;
    int *byname p;
    p = &w;
    p = p + 1;
    printflush(message1);
}
