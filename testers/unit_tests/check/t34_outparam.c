/* EXPECT: 11 22 1 1 */
/* `&x` handed to a builtin that writes through it: with optimize(pointer) the
   register is named directly, so x never has to live in memory.
   The simulated world makes `ulocate` find a core at (11, 22). */
#pragma optimize(pointer)
auto device message1;
int ox, oy, found;
bool nearFlag;
device bld;
void main() {
    ulocate("building", "core", false, &ox, &oy, &found, &bld);
    print(ox); print(oy); print(found);
    ucontrol("within", 1, 2, 3, &nearFlag);
    print(nearFlag);
    printflush(message1);
    stop();
}
