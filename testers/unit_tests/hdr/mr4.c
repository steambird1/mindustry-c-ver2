#include "merui.h"

auto device message1;

mOpRet_t use_macro(int flag) {
    exit_or_succ_as(go_to((float)flag, 0.0, 0.0));
    return (mOpRet_t)({true, 42, ERR_OK});
}

void use_exit_or_succ(int flag) {
    exit_or_succ(go_to((float)flag, 0.0, 0.0));
    print("reached");
}

void main() {
    mOpRet_t a = use_macro(1);
    print(a.operation_id);
    print(a.err_code);
    use_exit_or_succ(2);
    printflush(message1);
    stop();
}
