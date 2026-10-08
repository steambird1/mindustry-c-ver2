/* Must fail: `int s[] = r;` needs `r` to SAY how long it is, so an array with
   no length of its own cannot be the source. Both would then be open, and the
   length would have to come from somewhere else -- there is nowhere.

   A parameter is a different case: `void f(int s[])` works, because the
   argument it is given at each call site does carry a length (see
   `check/t148_open_array_two_lengths`). It is only an open dimension bound to
   another open dimension that has nothing to go on. */
/* MESSAGE: Neither 'b' nor what it is given says how many elements there are: one */
void f(int a[]) {
    int b[] = a;
    b[0] = 7;
    print(b[0]);
}
void main() {
    int r[4];
    f(r);
}
