/* EXPECT: 20 11 */
/* `oper(&coreX)` is inlined; coreX stays a register and the name pointer
   writes into it, then `ulocate` overwrites it with 11. */
auto device message1;
void oper(int *x) { (*x) = 20; }
void main() {
   int coreX, coreY, coreFound;
   device coreDevice;
   oper(&coreX);
   print(coreX);
   ulocate("building", "core", true, &coreX, &coreY, &coreFound, &coreDevice);
   print(coreX);
   printflush(message1);
   stop();
}
