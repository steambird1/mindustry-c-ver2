/* Must fail: `vecalias` binds into a handle the program OWNS, and an array
   parameter is not one.

   A parameter declared `int s[]` arrives as a handle, but it is a COPY the
   caller handed over. Binding into it would change what this function sees from
   here on and nothing else: the caller's array keeps the handle it was passed,
   which is the opposite of what the spelling suggests -- `vecalias(&s, b)` reads
   like "s is b now", and would quietly mean "s stopped being what you gave me".

   It is not a place a handle can be stored either. The parameter's register
   already holds the packed handle the argument delivery put there, so writing a
   second, different representation over it is a silent no-op rather than an
   error -- `s = b;` on a handle parameter is exactly that today, and this is
   the check that stops the intrinsic from inheriting the hole.

   A locally declared handle is the thing that works, and the message says so:
   `int h[];` is a cell this program owns, and binding into it is the whole of
   what `a = b;` does. */
/* MESSAGE: Cannot vecalias into 's': it is an array PARAMETER, and the handle in it is a COPY */
/* MESSAGE: leave the caller's array on the handle it already has */
/* MESSAGE: Declare a handle of your own \('int h\[\];'\) to bind instead */
int other[4] = {1, 2, 3, 4};
void rebind(int s[]) {
    vecalias(&s, other);
}
void main() {
    int m[3] = {5, 6, 7};
    rebind(m);
}
