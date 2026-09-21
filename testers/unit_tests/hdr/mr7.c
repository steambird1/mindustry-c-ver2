#include "merui.h"
auto device message1;
void main() {
    mOpRet_t ret = go_to(1.0, 2.0, 3.0);
    print(ret.success);
    printflush(message1); stop();
}
