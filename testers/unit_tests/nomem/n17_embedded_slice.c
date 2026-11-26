/*
No memory block at all: an `embedded` array keeps one register per element, so
a row (`e[i]`) and an explicit range (`slice`) are index views over registers.
Neither needs an address, which is exactly what makes them work here.
*/
/* EXPECT: 3 4 3 20 40 */
auto device message1;

int e[2][3] = array("embedded", {{1, 2, 3}, {4, 5, 6}});
int flat[6] = array("embedded", {10, 20, 30, 40, 50, 60});

void main() {
    int row[] = e[1];
    print(lenof(row));
    print(row[0]);

    int part[] = slice(flat, 1, 4);
    print(lenof(part));
    print(part[0]);

    /* A write through the range lands in the root's register. */
    part[1] = 40;
    print(flat[2]);

    printflush(message1);
    stop();
}
