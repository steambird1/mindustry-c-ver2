/* Must fail: a POINTER says nothing about how far it goes, so it cannot be what
   an array with an open dimension is bound to -- `s` would have no length even
   after binding. `int *p = r;` is a pointer to the first element, not an array.

   (This is also the reason `int s[]` is a handle rather than a pointer: the
   handle packs the length; a pointer cannot.) */
/* MESSAGE: The size of array 's' is neither given nor deducible: write a size, or */
void main() {
    int r[3];
    int *p = r;
    int s[] = p;
}
