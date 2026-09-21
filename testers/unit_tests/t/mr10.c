#include "merui.h"
auto device message1;
void g(int flag) {
    mOpRet_t ret = go_to((float)flag, 0.0, 0.0);
    if (!ret.success) return;
    print("reached");
}
void main() { g(1); printflush(message1); stop(); }
