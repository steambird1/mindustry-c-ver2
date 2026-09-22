/* EXPECT: 1 9 */
/* The same as t93, but the function is NOT inlined, so the array travels as a
   handle. Both paths have to write into the caller's array. */
#pragma noinline(test)
auto device message1;
void test(int s[5]) { s[1] = 1; s[3] = 9; }
void main() {
    int r[5] = array("embedded_divided", {0, 0, 0, 0, 0});
    test(r);
    print(r[1]);
    print(r[3]);
    printflush(message1); stop();
}
