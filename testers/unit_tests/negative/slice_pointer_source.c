/* A pointer has no length of its own, so there is no element sequence to
   view and no end to measure from. Name the array itself. */
/* MESSAGE: The first argument of 'slice' must be the name of an array or a handle */
void main() {
    int a[6] = {1, 2, 3, 4, 5, 6};
    int *p = a;
    int b[] = slice(p, 1);
    print(b[0]);
}
