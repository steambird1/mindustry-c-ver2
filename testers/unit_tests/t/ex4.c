#include "sharelist.js"
auto device message1;
void main() {
    sdlist_t l = sdcreate(7, 5);
    int i;
    for (i = 0; i < 5; i++) { sdwrite(@this, l, i, i * 10); }
    for (i = 0; i < 5; i++) { print(sdread(@this, l, i)); }
    printflush(message1); stop();
}
