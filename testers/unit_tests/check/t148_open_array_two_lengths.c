/* EXPECT: 3 9 */
/* One open-dimension parameter, two call sites, two different lengths -- 3 and
   9. Nothing here can be folded to a single number, so this is what forces the
   length to travel with the array instead of living in the declaration:
   `3 9` rather than one value that is right at one call site and wrong at the
   other.

   It also pins the cost of the model. With the call inlined, each site binds
   the parameter to the caller's array and the length folds straight out of the
   caller's own type, so the two forms compile to the same instructions. Under
   `#pragma noinline` (which check.mjs re-runs every test under) each site
   builds a handle instead, and pays for it -- 146 instructions against 119 --
   which is the trade being made. */
auto device message1;
void put(int s[]) {
    s[0] = 7;
    print(lenof(s));
}
void main() {
    int a[3];
    int b[9];
    put(a);
    put(b);
    printflush(message1); stop();
}
