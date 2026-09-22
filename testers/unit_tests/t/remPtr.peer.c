/* The processor `int *remote q` reaches into: it owns a pointer to its own
   memory and publishes it, so the other side can read q_block / q_pos. */
auto device message1;
volatile int c;
extern int *qq;
void main() {
    qq = &c;
}
