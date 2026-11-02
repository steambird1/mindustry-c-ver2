/* MESSAGE: A remote array must keep its elements in registers */
/*
A remote array is flattened, but every element still has to fit the register
layout on the other processor. A pointer element needs a block/pos pair, so it
cannot use the element-name protocol.
*/
auto device message1;

extern int *u[2][2];
remote int *ru[2][2] = remote(@this, u);

void main() {
    print(1);
    printflush(message1);
    stop();
}
