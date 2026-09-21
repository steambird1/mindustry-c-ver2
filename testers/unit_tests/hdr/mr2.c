#include "merui.h"

auto device message1;

void main() {
    mOpRet_t r = unit_bind(@poly, false);
    print(r.success);
    print(r.operation_id);
    print(r.err_code);
    printflush(message1);
    stop();
}
