/* MESSAGE: printf flags/width/precision are only supported for compile-time constant arguments */
/* mlog has no width/precision operand: refuse a runtime value instead of
   silently printing it unformatted. */
#include <stdio.h>

auto device message1;

void main() {
    volatile int x = 3;
    printf("[%2d]", x);
    printflush(message1);
    stop();
}
