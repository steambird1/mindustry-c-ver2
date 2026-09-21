/*
merui.h: Package of most of automated operations.

By compassing preset logic, this header can simplify programming.
*/

#ifndef _MERUI_H
#define _MERUI_H

struct mOpRet_t {
    bool success;
    int operation_id;
    int err_code;
};

device get_core(bool combat) {
    // This will bind ANY unit (but hopefully will not affect execution)
    int i, coreX, coreY;
    bool coreFound;
    device coreDevice;
    while (true) {
        for (i = 0; i < @unitCount; i++) {
            ubind((unit_t)i);
            if ((bool)sensor(@unit, @controlled)) continue;
            if (!((bool)sensor(@unit, @dead))) {
                ulocate("building", "core", combat, &coreX, &coreY, &coreFound, &coreDevice);
                if (coreFound) {
                    ucontrol("unbind");
                    return coreDevice;
                }
            }
        }
    }
}

device get_player() {
    return radar("player", "ally", "any", "distance", @this, 1);
}

// Used for some macros.
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
#define OP_MINE 5

#define ERR_IN_PROGRESS -1
#define ERR_OK 0
#define ERR_MINE_NOT_FOUND 1

mOpRet_t __check_bind(content_t type) {
    return (mOpRet_t)({!((bool)sensor(@unit, @dead) || ((content_t)sensor(@unit, @type) != type)), OP_BIND});
}

mOpRet_t unit_bind(content_t type, bool rebind) {
    if (!rebind) {
        if (!__check_bind(type).success) rebind = true;
    }
    if (rebind) ubind(type);
    return __check_bind(type);
}

mOpRet_t go_to(float x, float y, float radius) {
    bool is_within;
    ucontrol("within", x, y, radius, &is_within);
    if (is_within) return (mOpRet_t)({true, OP_GOTO});
    ucontrol("pathfind", x, y);
    return (mOpRet_t)({false, OP_GOTO, ERR_IN_PROGRESS});
}

mOpRet_t take_item(device source, content_t object, int amount) {
    exit_or_succ_as(go_to((float)sensor(source, @x), (float)sensor(source, @y), 3));
    ucontrol("itemTake", source, object, amount);
    return (mOpRet_t)({(int)sensor(@unit, object) >= amount, OP_TAKE});
}

mOpRet_t drop_item(device target, content_t object, int amount) {
    exit_or_succ_as(go_to((float)sensor(target, @x), (float)sensor(target, @y), 3));
    ucontrol("itemDrop", target, object, (int)sensor(@unit, object));
    return (mOpRet_t)({(int)sensor(@unit, object) <= amount, OP_DROP});
}

mOpRet_t mining(content_t category) {
    int oreX, oreY;
    bool oreFound;
    device oreDevice;
    ulocate("ore", category, &oreX, &oreY, &oreFound, &oreDevice);
    if (!oreFound) return (mOpRet_t)({false, OP_MINE, ERR_MINE_NOT_FOUND});
    exit_or_succ_as(go_to(oreX, oreY, 3));
    ucontrol("mine", oreX, oreY);
    return (mOpRet_t)({true, OP_MINE, ERR_OK});
}

// TODO ...


#endif