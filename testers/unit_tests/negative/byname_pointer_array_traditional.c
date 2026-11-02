/* MESSAGE: must use the register layout */
/*
A name pointer is one register; putting it in memory would need a separate
name-pointer-in-memory representation, so this layout is refused.
*/
auto device message1;

int x = 7;
int *byname a[1] = array("traditional", {byname(&x)});

void main() {
    print(*a[0]);
    printflush(message1);
    stop();
}
