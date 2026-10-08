/* Must fail: an array bound to another array cannot be pointed somewhere else.
   `s` is not an array of its own -- it IS `r`, so the storage is `r`'s and the
   code that reaches it was generated for `r`. There is nothing behind `s` to
   rebind, and writing to it used to be accepted and then dropped.

   Binding happens on the DECLARATION, which is the only point where no storage
   has been handed out yet. */
extern int r[4] = {1, 2, 3, 4};
int s[] = r;
int q[4] = {9, 9, 9, 9};
/* MESSAGE: Cannot assign to 's': it is not an array of its own, it is 'r' itself\. */
void main() {
    s = q;
}
