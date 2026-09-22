#include "archon.js"
auto device message1;
void main() {
    bool f = argetflag("myflag");
    arsetflag("myflag", true);
    print(f);
    printflush(message1); stop();
}
