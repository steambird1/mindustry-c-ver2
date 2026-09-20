/* EXPECT: 11 22 1 1 */
/* The same without the pragma: the builtin result is written into the
   temporary and copied to the variable's memory location. */
auto device message1;
int ox, oy, found;
bool nearFlag;
int bld;
void main() {
    ulocate("building", "core", false, &ox, &oy, &found, &bld);
    print(ox); print(oy); print(found);
    ucontrol("within", 1, 2, 3, &nearFlag);
    print(nearFlag);
    printflush(message1);
    stop();
}
