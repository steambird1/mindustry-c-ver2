#include "merui.h"
auto device message1;
void use_exit_or_succ(int flag) {
    exit_or_succ(go_to((float)flag, 0.0, 0.0));
    print("reached");
}
void main() { use_exit_or_succ(2); printflush(message1); stop(); }
