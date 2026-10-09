/*
The copy is not memory-only: it goes through the same `element(i)` views a
subscript uses, so a register (divided) destination copies the same way a
memory one does. `a = b;` used to be a reference-wise no-op here too --
layout never entered into it, because nothing was written at all.

`array("embedded_divided")` is requested, so this stays a divided register
array under every pragma variant; the loop is the veccpy loop with the
literal bound 4.
*/
/* EXPECT: 5 6 7 8 */
/* EMIT: op lessThan [^ ]* [^ ]* \d+ */
/* EMIT: jump \d+ equal [^ ]* false */
/* EMIT: op add [^ ]* [^ ]* 1 */
auto device message1;
int a[4] = array("embedded_divided", {0, 0, 0, 0});
int b[4] = array("embedded_divided", {5, 6, 7, 8});
void main() {
    a = b;
    print(a[0]);
    print(a[1]);
    print(a[2]);
    print(a[3]);
    printflush(message1);
    stop();
}