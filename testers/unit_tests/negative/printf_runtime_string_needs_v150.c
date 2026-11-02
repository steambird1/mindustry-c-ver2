/* VERSION: 149 */
/* MESSAGE: printf width/precision for %s requires v150 or higher */
/* Runtime string formatting needs @size/read/printchar, which arrived in v150. */
#include <stdio.h>

auto device message1;

void main() {
    volatile string_t s = "hi";
    printf("[%5s]", s);
    printflush(message1);
    stop();
}
