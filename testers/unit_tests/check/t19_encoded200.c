/* EXPECT: 200 201 202 203 204 205 206 207 */
/* Encoded constant array, values too large for one character: they are split
   into base-57 digits, one string table per digit, and put back together with
   Horner's rule (`mul`, `add`, then one `sub` for the offset correction).
   `array("encoded", ...)` is required: with memory to spare the compiler
   would otherwise keep the array in memory. */
auto device message1;
volatile int vi;
const int thre[8] = array("encoded", {200, 201, 202, 203, 204, 205, 206, 207});
void main() {
    int i = vi;
    while (i < 8) {
        print(thre[i]);
        i = i + 1;
    }
    printflush(message1);
    stop();
}
