/* An embedded array keeps every element in a register of its own, so no
   element has an address to take. `slice(e, i)` is the form that names a
   range of the element sequence. */
/* MESSAGE: Cannot take the address of */
int e[2][3] = array("embedded");

void main() {
    int b[] = &e[1];
    print(b[0]);
}
