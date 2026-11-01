/* MESSAGE: \(volatile T\*\) output parameters were removed; use '&x' instead */
/* The old output-cast spelling is gone; use the nominal pointer. */
auto device message1;

void main() {
    int x, y, found;
    device bld;
    ulocate("building", "core", false,
        (volatile int*)(&x),
        (volatile int*)y,
        (volatile int*)found,
        &bld);
    printflush(message1);
    stop();
}
