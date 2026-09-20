/* EXPECT: 77 22 1 core1 */
#pragma optimize(pointer)
auto device message1;
void main() {
   int coreX, coreY, coreFound;
   device coreDevice;
   int *s = &coreX;
   ulocate("building", "core", true, &coreX, &coreY, &coreFound, &coreDevice);
   *s = 77;
   print(coreX); print(coreY); print(coreFound); print(coreDevice);
   printflush(message1);
   stop();
}
