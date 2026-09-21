#include "merui.h"
auto device message1;
mOpRet_t f(int flag) {
    mOpRet_t ret = go_to((float)flag, 0.0, 0.0);
    if (!ret.success) return ret;
    return (mOpRet_t)({true, 42, ERR_OK});
}
void main() { mOpRet_t a = f(1); print(a.operation_id); printflush(message1); stop(); }
