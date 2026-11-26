/* `e + i` is pointer arithmetic, and an embedded array has no pointer: the
   elements are separate registers. `slice(e, i)` is the view form. */
/* MESSAGE: Cannot apply */
int e[2][3] = array("embedded");

void main() {
    int b[] = e + 1;
    print(b[0]);
}
