#include "merui.h"

auto device message1;

void main() {
    device core = get_core(false);
    print(core);
    printflush(message1);
    stop();
}
