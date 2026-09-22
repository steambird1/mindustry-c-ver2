/* EXPECT: 1 9 */
/* An array held in registers has no address, so it travels as a HANDLE: two
   registers holding the entry points of its get/set helpers. Writing through
   the handle must land in the CALLER's array. */
auto device message1;
void test(int s[5]) { s[1] = 1; s[3] = 9; }
void main() {
    int r[5] = array("embedded_divided", {0, 0, 0, 0, 0});
    test(r);
    print(r[1]);
    print(r[3]);
    printflush(message1); stop();
}
