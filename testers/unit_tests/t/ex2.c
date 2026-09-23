#include "archon.js"
auto device message1;
void main() {
    argetblock("floor", 1, 2);
    arsetblock("floor", @copper, 1, 2, @copper, 0);
    bool w = arweathersense(@rain);
    arweatherset(@rain, true);
    arspawnwave(1, 2, true);
    arsetrule("mapArea", 0, 0, 100, 100);
    armessage("notify", "hello");
    arcutscene("stop");
    areffect("warn", 1, 2, 3, "raw");
    arexplosion(@team, 1, 2, 3, 4, true, false, true, false);
    arsetprop(@copper, @this, null);
    arplaysound("global", 1, 2, 3, 4, 5);
    armakemarker("m", 1, 2, 3, true);
    arsetmarker("m", 1);
    print(w);
    printflush(message1); stop();
}
