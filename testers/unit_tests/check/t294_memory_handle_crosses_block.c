/*
A handle to a memory array has to step through the block chain exactly like
ordinary pointer arithmetic. The helper used to compute only
`base_pos + index * size`, so the first element past the end of the block
addressed a cell beyond the block instead of continuing in the next one.

`array("traditional")` keeps this array in memory under `#pragma optimize(array)`
too, so the cross-block case is not replaced by a register layout.
*/
/* EXPECT: 65 42 */
/* EMIT: set __arrstep __arridx */
auto device message1;

int a[70] = array("traditional");

void main() {
    int i;
    for (i = 0; i < 70; i++) a[i] = i;

    int b[];
    b = a;

    print(b[65]);
    b[68] = 42;
    print(a[68]);

    printflush(message1);
    stop();
}
