/* MESSAGE: needs single-cell elements */
/*
An ordinary pointer is a block/pos pair, not a single register. A register
array cannot hold it; use a memory array, or a byname pointer for the
one-register form.
*/
auto device message1;

int x = 7;
int *a[1] = array("embedded_divided", {&x});

void main() {
    print(*a[0]);
    printflush(message1);
    stop();
}
