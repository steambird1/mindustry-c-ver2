/*
Target 154 with NO memory block linked: including the standard headers must
not make their unused inline helpers part of this program.

`puts` in stdio.h is `inline` and indexes a `char*`; `string.h`, `stdlib.h`,
`inttypes.h` and `memory.h` are the same story. Nothing here calls them, so
none of them may report that a pointer parameter needs a real address.
*/
/* EXPECT: 1 */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <inttypes.h>
#include <memory.h>

auto device message1;

void main() {
    print(1);
    printflush(message1);
    stop();
}
