/* The processor the main program reaches into: it owns a pointer `qq` and
   publishes it, so the other side can read the pair qq_block / qq_pos. */
auto device message1;
volatile int c;
extern int *qq;
void main() {
    qq = &c;
    printflush(message1);
}
