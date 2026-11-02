/* MESSAGE: printf width/flags for %f require an explicit precision */
/* A runtime %f with width has no natural-length information; require an
   explicit precision so the formatter can compute the width. */
#include <stdio.h>

auto device message1;

void main() {
    volatile float x = 2.5;
    printf("[%8f]", x);
    printflush(message1);
    stop();
}
