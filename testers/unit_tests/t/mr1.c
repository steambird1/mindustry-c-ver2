/* KNOWN-GAP: never finishes: get_core() loops `for (i = 0; i < @unitCount; ...)` inside
   `while (true)`, and the simulated world has no units, so the body never
   runs and no core is ever found.
*/
#include "merui.h"

auto device message1;

void main() {
    device core = get_core(false);
    print(core);
    printflush(message1);
    stop();
}
