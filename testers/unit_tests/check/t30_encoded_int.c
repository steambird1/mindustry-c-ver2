/* EXPECT: 200 200 200 200 */
/* array("encoded", ...) named explicitly: the value must come out of a string
   table, not be replaced by a select chain. */
auto device message1;
volatile int vi;
const int thre[4] = array("encoded", {200, 200, 200, 200});
void main() {
    int i = vi;
    print(thre[i]);
    i = vi + 1;
    print(thre[i]);
    i = vi + 2;
    print(thre[i]);
    i = vi + 3;
    print(thre[i]);
    printflush(message1);
    stop();
}
