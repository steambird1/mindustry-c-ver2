/* An `encoded` array is a constant table: its contents are the representation
   itself, so there is no storage a slice could start inside. */
/* MESSAGE: Cannot slice 'table': it is a constant table */
const int table[4] = array("encoded", {1, 2, 3, 4});

void main() {
    const int b[] = slice(table, 1, 3);
    print(b[0]);
}
