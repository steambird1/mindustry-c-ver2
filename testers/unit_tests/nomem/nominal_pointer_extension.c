/*
No memory block: a JS extension's nominal pointer keeps the target in a
register and passes its name, so this works without byname.
*/
/* VERSION: 148 */
/* EXPECT: 42 */
#include "nomtest.js"

auto device message1;

void main() {
    int x;
    nomstore(&x, 42);
    print(x);
    printflush(message1);
    stop();
}
