/*
The encoded layout reads a character code and subtracts the table offset before
the value can be used. When the next instruction adds or subtracts a constant,
that correction is folded into the constant, so an arithmetic access needs one
instruction instead of two. The product-level pass only does this when the
intermediate has no other reader.
*/
/* EMIT: op add [^ ]+ [^ ]+ -34 */
/* EMIT-NOT: op sub [^ ]+ [^ ]+ 35 */
#pragma optimize(array)
auto device message1;
const int b[5] = array("encoded", {1, 9, 1, 9, 8});
volatile int i;

void main() {
    i = (int)(@time * 3.0) % 5;
    print(b[i] + 1);
    printflush(message1);
    stop();
}
