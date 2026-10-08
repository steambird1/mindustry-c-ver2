/* Must fail: `veccpy` reads its source, and an unbound handle that is never
   bound has nothing to read.

   `int h[];` is a handle with no array behind it until something binds one. The
   copy loop would dereference it on the first iteration, so the "never bound"
   check has to count `veccpy` as a READ of its second argument -- the same way
   it counts `h[0]` or `print(h)`.

   This is a check that existed before `veccpy` did, meeting a new way to reach
   an array. It is its own case because the interaction is the thing being
   tested: an intrinsic that the read-walker did not know about would compile
   and then trap at run time, and the only symptom would be a machine fault in
   generated code rather than a sentence in the source. */
/* MESSAGE: Array 'h' is an unbound handle that is never bound: write 'h = someArr */
int dst[4];
int h[];
void main() {
    veccpy(dst, h);
}
