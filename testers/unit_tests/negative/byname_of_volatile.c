/* Must fail: a `volatile` variable is in memory by definition, so it has no
   register whose name a pointer could store. */
auto device message1;
void main() {
    volatile int w = 1;
    int *byname p;
    p = &w;
    printflush(message1);
}
