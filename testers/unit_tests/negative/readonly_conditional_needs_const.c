/* A conditional that may choose a constant table is read-only at run time:
   the encoded branch has no set helper. The destination has to say so. */
/* MESSAGE: A conditional choosing a read-only array can only be bound to a read-only handle */
const int encoded[3] = array("encoded", {1, 2, 3});
int writable[3];

void main() {
    int h[] = 0 ? encoded : writable;
    print(h[0]);
}
