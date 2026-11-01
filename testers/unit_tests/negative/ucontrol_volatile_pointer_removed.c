/* MESSAGE: \(volatile T\*\) output parameters were removed; use '&x' instead */
/* ucontrol output parameters use &x too. */
auto device message1;

void main() {
    bool state;
    ucontrol("within", 11, 22, 3, (volatile bool*)state);
    printflush(message1);
    stop();
}
