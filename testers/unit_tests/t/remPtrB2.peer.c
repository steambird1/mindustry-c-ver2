/* The processor `int *remote q` reaches into: it owns a pointer named qq2. */
auto device message1;
volatile int vc2;
extern int *qq2;
void main() {
    qq2 = &vc2;
}
