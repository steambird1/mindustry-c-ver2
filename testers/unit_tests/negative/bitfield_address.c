/* MESSAGE: cannot take the address of bitfield */
/* A bitfield has no address of its own; it lives inside a storage cell. */
auto device message1;
struct F {
    unsigned a : 3;
};
void main() {
    struct F f;
    unsigned *p = &f.a;
    print(p);
    printflush(message1);
    stop();
}
