/* MESSAGE: Multidimensional register/lookup arrays are not supported yet */
/* A register array has one cell per element; the current layout has no shape
   for a second dimension. A memory-backed layout is required. */
auto device message1;

int grid[2][3] = array("embedded_divided", {{1, 2, 3}, {4, 5, 6}});

void main() {
    print(grid[1][2]);
    printflush(message1);
    stop();
}
