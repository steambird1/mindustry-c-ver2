/* Must fail: writing INTO an encoded array cannot be a copy, because an
   encoded array is a constant table of contents -- there are no cells behind
   the name for copied elements to land in. `c = d` used to be admitted and
   silently did nothing (the old "assign by reference" copied no elements);
   the §3.6 copy work made the no-op impossible to keep, and the layout
   itself settles the question: even without `const`, the encoded layout
   leaves nothing to write to (a genuinely `const` target gets the plain
   "Cannot assign to const variable" refusal instead, further down the pass). */
/* MESSAGE: Cannot assign to 'c': an encoded array is a constant table of contents */
int c[4] = array("encoded", {1, 2, 3, 4});
int d[4] = array("encoded", {5, 6, 7, 8});
void main() {
    c = d;
}