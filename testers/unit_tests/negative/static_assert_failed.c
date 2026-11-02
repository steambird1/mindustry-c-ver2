/* MESSAGE: Static assertion failed: int size */
/* A false _Static_assert is a compile-time error. */
#include <assert.h>

_Static_assert(sizeof(int) == 2, "int size");

auto device message1;

void main() {
    printflush(message1);
    stop();
}
