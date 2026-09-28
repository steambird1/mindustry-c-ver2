/* EXPECT: 7 7 */
/* An array parameter written `int s[]` has no length of its own, and the
   inliner used to keep the PARAMETER's type when it bound that parameter to
   the caller's array. So the alias was an `int[]`: its size came out NaN, and a
   stack frame advanced by NaN never finishes -- `___stackframe_forward`
   compares `__step` against the block size, every comparison is false, and the
   program runs forever without printing anything.

   The alias is not an `int[]`, though: it is the caller's `int r[5]`, with the
   caller's five elements. Binding it to the caller's TYPE as well as the
   caller's array is what makes the frame advance (and `lenof`) come out right.

/* Both parts are checked. The output alone would pass on any program that
   merely got far enough to print, and `EMIT-NOT` is what pins the shape: a NaN
   anywhere in the code is a step count that cannot finish. */
/* EMIT-NOT: NaN */
auto device message1;
void fill(int s[]) {
    s[1] = 7;
    print(s[1]);
}
void main() {
    int r[5];
    r[0] = 1;
    fill(r);
    print(r[1]);
    printflush(message1); stop();
}
