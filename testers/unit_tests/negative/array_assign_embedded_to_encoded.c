/* Must fail: two NAMED layouts that are not the same layout. `array("embedded")`
   and `array("encoded")` both used to answer `null` when the semantic pass
   asked how they are stored, so `null == null` saw no difference between them
   and this assignment slipped through. Both answer their own names now, so it
   is refused for the reason it always should have been: they are not stored
   the same way, and there is no instruction that turns one into the other. */
/* MESSAGE: Cannot assign an encoded array to an embedded array: ' */
int e[4] = array("embedded", {1, 2, 3, 4});
int k[4] = array("encoded", {5, 6, 7, 8});
void main() {
    e = k;
}