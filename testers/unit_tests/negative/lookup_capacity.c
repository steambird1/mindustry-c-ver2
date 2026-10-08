/* MESSAGE: Array 'u' has 30 elements, but the 'item' lookup table only names 20:  */
/* An array named after a lookup table cannot be longer than that table: the
   extra elements would have no name and read back as 0. */
extern int u[30] = array("embedded_lookup_item", {1});
void main() { print(u[0]); }
