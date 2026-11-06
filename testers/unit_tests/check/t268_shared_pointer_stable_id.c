/*
A `shared` pointer is a building-backed value in registers. Storing it in a
memory slot writes a program-level stable id (bank1 is logical block 1), not a
local link id. Reading the slot maps that id back to this processor's building.
*/
/* EXPECT: 2 3 */
/* EMIT: set g:\.data_block bank1 */
/* EMIT: write 1 bank1 \d+ */
/* EMIT: select [^ ]+ equal [^ ]+ 1 bank1 [^ ]+ */
/* EMIT-NOT: getlink __curb */
auto device message1;
int data[4] = {1, 2, 3, 4};
shared int *volatile slot;

void main() {
    shared int *p = &data[1];
    print(*p);

    slot = &data[2];
    print(*slot);

    printflush(message1);
    stop();
}
