/* Must fail: `veccpy` writes into storage, and a handle is not storage.

   The two intrinsics are not two spellings of one thing, and the difference is
   the whole design: `vecalias` binds a NAME, `veccpy` copies ELEMENTS. A handle
   is a name -- one register holding a length and two helper entry points -- and
   there are no elements in it to write, so a `veccpy` into one has nowhere to
   put anything. Looping over `h[0..n]` would also be nonsense: those subscripts
   go through the helper, which reaches the OTHER array.

   So the refusal has to say what to write instead, and what to write instead is
   `vecalias`. A message that only refused would leave the two intrinsics looking
   interchangeable, which is the mistake this case exists to catch.

   The unbound handle is the same refusal, said the same way -- a cell that
   holds no handle yet is still a cell, and `h[0]` is still not storage. */
/* MESSAGE: Cannot veccpy into 'h': a handle is a NAME, not storage, so it has no elements */
/* MESSAGE: Write 'vecalias\(&h, b\);' to bind it instead */
/* MESSAGE: Cannot veccpy into 'e': a handle is a NAME, not storage, so it has no elements */
int src[4] = {1, 2, 3, 4};
int h[];
void main() {
    int e[];
    h = src;
    veccpy(h, src);
    veccpy(e, src);
    e = src;
}
