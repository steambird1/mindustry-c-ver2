/* MESSAGE: needs single-cell elements */
/*
A pointer element needs a block/pos pair, so a lookup/register array cannot
store it as one name per element.
*/
auto device message1;

int x = 7;
int *a[1] = array("embedded_lookup_item", {&x});

void main() {
    print(*a[0]);
    printflush(message1);
    stop();
}
