/* Must fail: `*p = 5` through a pointer that was never given a target, with no
   memory block linked, needs a real address and there is nowhere to keep one.
   The diagnostic has to say what to do about it. */
/* NOMEM */
void main() {
    int *p;
    (*p) = 5;
}
