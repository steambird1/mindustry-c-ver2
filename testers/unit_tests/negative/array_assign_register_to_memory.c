/* Must fail: an array held in REGISTERS cannot be assigned to a memory array.
   Nothing about the type name tells these apart -- both print as `int[4]` --
   so the check has to ask how each is stored. A register array has no
   address at all (see `array_no_address_to_function_pointer.c`); a memory
   array is a block and an offset. The assignment would have to turn one into
   the other, and there is no instruction for that.

   So they are different TYPES, which is also why an `auto` parameter asks for
   a version per layout rather than accepting whatever it is given. */
/* MESSAGE: Cannot assign an embedded array to an array in memory: ' */
int reg[4] = array("embedded_divided", {0, 0, 0, 0});
int mem[4];
void main() {
    mem = reg;
}
