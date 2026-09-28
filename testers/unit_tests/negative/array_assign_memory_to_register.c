/* Must fail: the other direction -- a MEMORY array assigned to an array held
   in registers. Same reason as `array_assign_register_to_memory`, and kept
   separate for the same reason: the message names the two sides, so this one
   fails if the check only ever reads the right-hand array. */
/* MESSAGE: Cannot assign an array in memory to an array in registers */
int reg[4] = array("embedded_divided", {0, 0, 0, 0});
int mem[4];
void main() {
    reg[0] = 1;
    mem[0] = 2;
    reg = mem;
}
