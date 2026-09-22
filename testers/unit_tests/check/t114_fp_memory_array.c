/* EXPECT: 3 8 */
/* An ordinary in-memory array handed to a FUNCTION POINTER: it has an address,
   so it travels as a pointer, exactly as in a direct call -- and the callee can
   step it with `s[i]` as usual. */
auto device message1;
int mem[4];
typedef void (*cb)(int s[4]);
void fill(int s[4]) { s[0] = 3; s[3] = 8; }
void main() {
    cb p = fill;
    p(mem);
    print(mem[0]); print(mem[3]);
    printflush(message1); stop();
}
