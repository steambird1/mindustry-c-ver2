#include "merui.h"

auto device message1;
auto device vault1;

mOpRet_t try_take() {
    mOpRet_t g = go_to(10.0, 20.0, 3.0);
    if (!g.success) return g;
    return (mOpRet_t)({true, OP_TAKE, ERR_OK});
}

void main() {
    mOpRet_t a = try_take();
    print(a.success);
    print(a.operation_id);
    print(a.err_code);
    mOpRet_t b = unit_bind(@poly, true);
    print(b.operation_id);
    printflush(message1);
    stop();
}
