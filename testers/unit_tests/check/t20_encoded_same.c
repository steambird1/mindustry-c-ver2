/* EXPECT: 200 200 200 200 200 200 200 200 */
/* Every element equal: both digit tables are a single repeated character, and
   the value comes back through the Horner correction. Forced with
   `array("encoded", ...)` so the array is not quietly kept in memory. */
auto device message1;
volatile int vi;
const int thre[8] = array("encoded", {200, 200, 200, 200, 200, 200, 200, 200});
void main() {
    int i = vi;
    while (i < 8) {
        print(thre[i]);
        i = i + 1;
    }
    printflush(message1);
    stop();
}
