/* EXPECT: 7 */
/* A MEMORY array handed to a function pointer whose parameter is a handle.
   Memory arrays normally travel as pointers -- and still do, everywhere else --
   but a handle can be made of one too: the helper works out `base + i * size`,
   turns the block number into the building and reads through it. So the two
   representations stay interchangeable, and one function can serve both. */
auto device message1;
int mem[4];
typedef void (*cbr)(remote int s[4]);
void fill(remote int s[4]) { s[0] = 7; }
void main() {
    mem[0] = 1;
    cbr p = fill;
    p(mem);
    print(mem[0]);
    printflush(message1); stop();
}
