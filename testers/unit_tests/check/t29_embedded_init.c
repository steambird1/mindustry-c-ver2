/* EXPECT: 200 200 200 200 */
/* array("embedded"): one register per element. The registers must actually be
   FILLED IN -- they used to be emitted without ever being written. */
auto device message1;
volatile int vi;
const int thre[4] = array("embedded", {200, 201, 202, 203});
const int same[4] = array("embedded", {200, 200, 200, 200});
void main() {
    int i = vi;
    print(thre[i] - i);      /* 200 whichever the index */
    i = vi + 1;
    print(thre[i] - i);
    i = vi + 2;
    print(thre[i] - i);
    i = vi + 3;
    print(thre[i] - i);
    printflush(message1);
    stop();
}
