/* Must fail: an ordinary pointer with no memory block linked. The address of
   `w` has nowhere to live, so this is a compile error that points at
   `#pragma optimize(pointer)`, `int *byname p` and `byname(&x)`. */
/* NOMEM */
void main() {
    int w = 1;
    int *p;
    p = &w;
    (*p) = 2;
}
