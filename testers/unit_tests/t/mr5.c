#include "merui.h"
auto device message1;
mOpRet_t use_macro(int flag) {
    exit_or_succ_as(go_to((float)flag, 0.0, 0.0));
    return (mOpRet_t)({true, 42, ERR_OK});
}
void main() {
    mOpRet_t a = use_macro(1);
    print(a.operation_id);
    printflush(message1);
    stop();
}
