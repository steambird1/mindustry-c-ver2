/* EXPECT: 1 */
/* An ordinary in-memory array still travels as a pointer -- the handle is only
   for the layouts that have no address. */
auto device message1;
void test(int s[5]) { s[1] = 1; }
void main() {
    int r[5];
    r[1] = 0;
    test(r);
    print(r[1]);
    printflush(message1); stop();
}
