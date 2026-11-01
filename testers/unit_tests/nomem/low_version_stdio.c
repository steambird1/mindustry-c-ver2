/*
No memory block and target 148: a program with no pointer use must still
compile. This is the stdio.h case that used to fail with a byname error.
*/
/* VERSION: 148 */
/* EXPECT: hi03 */
#include <stdio.h>

auto device message1;

void main() {
    printf("%s%02d", "hi", 3);
    printflush(message1);
    stop();
}
