/*
No memory block and target 148: ulocate output parameters use `&x` and are
passed as register names, so no byname or memory is needed.
*/
/* VERSION: 148 */
/* EXPECT: 11 22 1 core1 */
auto device message1;

void main() {
    int x, y, found;
    device bld;
    ulocate("building", "core", false, &x, &y, &found, &bld);
    print(x);
    print(y);
    print(found);
    print(bld);
    printflush(message1);
    stop();
}
