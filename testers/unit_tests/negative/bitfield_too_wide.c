/* MESSAGE: limited to 52 bits */
/* A packed storage cell is limited by the exact integer range used by mlog. */
auto device message1;
struct F {
    unsigned a : 53;
};
void main() {
    struct F f;
    printflush(message1);
    stop();
}
