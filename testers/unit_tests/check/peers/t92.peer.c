/* The processor the main program reaches into.
   It owns a real memory pointer and publishes it (extern), so the other side
   can read the pair qq_block / qq_pos. */
auto device message1;
volatile int c;
extern int *qq;
void main() {
    qq = &c;
}
