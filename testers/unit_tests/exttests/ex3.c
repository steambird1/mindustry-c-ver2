#include "sharelist.js"
auto device message1;
void main() {
    sdlist_t l = sdcreate(1, 4);
    sdwrite(@this, l, 0, 42);
    null_t v = sdread(@this, l, 0);
    print(v);
    printflush(message1); stop();
}
