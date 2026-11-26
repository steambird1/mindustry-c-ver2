/* A concrete array has storage of its own; a slice is a handle. Initializing
   one with the other would have to copy elements, and the spelling reads as a
   binding. Use an open handle, or copy with veccpy. */
/* MESSAGE: Cannot initialize 'b' with a slice */
void main() {
    int a[6] = {1, 2, 3, 4, 5, 6};
    int b[3] = slice(a, 1, 4);
    print(b[0]);
}
