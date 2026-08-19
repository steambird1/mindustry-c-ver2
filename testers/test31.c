/*
merui.h: Package of most of automated operations.
*/

#ifndef _MERUI_H
#define _MERUI_H

struct mOpRet_t {
    bool success;
    int operation_id;
};

auto device message1;

void __noop() {

}

#define wait_for_succ(operation) while (true) { mOpRet_t ret = (operation); if (ret.success) break; } __noop()
#define exit_or_succ_with(operation, code) if (true) { mOpRet_t ret = (operation); if (!ret.success) return code; } __noop()
#define exit_or_succ_as(operation) if (true) { mOpRet_t ret = (operation); if (!ret.success) return ret; } __noop()
#define exit_or_succ(operation) if (true) { mOpRet_t ret = (operation); if (!ret.success) return; } __noop()

#define OP_BIND 1
#define OP_GOTO 2
#define OP_TAKE 3
#define OP_DROP 4

mOpRet_t __check_bind(content_t type) {
    return (mOpRet_t)({!((bool)sensor(@unit, @dead) || ((content_t)sensor(@unit, @type) != type)), OP_BIND});
}

mOpRet_t unit_bind(content_t type, bool rebind) {
    if (!rebind) {
        print("Non-rebind logic");
        printflush(message1);
        wait(0.2);
        if (!__check_bind(type).success) rebind = true;
    }
    print("Pre-rebind, state:",rebind);
    printflush(message1);
    wait(0.2);
    if (rebind) ubind(type);
    print("Pre-return, state:",rebind);
    printflush(message1);
    wait(0.2);
    return __check_bind(type);
}

mOpRet_t go_to(float x, float y, float radius) {
    bool is_within;
    ucontrol("within", x, y, radius, (volatile bool*)is_within);
    if (is_within) return (mOpRet_t)({true, OP_GOTO});
    ucontrol("pathfind", x, y);
    return (mOpRet_t)({false, OP_GOTO});
}

#endif

void work() {
    print("Pre work()");
    printflush(message1);
    wait(0.2);
    mOpRet_t ret;
    ret = (unit_bind(@mega, true));
    print("bind Ret:",ret.success,"@",ret.operation_id);
    printflush(message1);
    wait(0.2);
    if (!ret.success) return;
    print("Post work() binding");
    printflush(message1);
    wait(0.2);
    ret = go_to(0, 0, 1);
    print("goto Ret:",ret.success,"@",ret.operation_id);
    printflush(message1);
    wait(0.2);
}

void main() {
    while (true) {
        work();
    }
}