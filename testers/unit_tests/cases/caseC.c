#pragma optimize(pointer)
auto device message1;
void main() {
   volatile int coreX;
   int coreY, coreFound;
   device coreDevice;
   int *s = &coreX;
   ulocate("building", "core", true, &coreX, &coreY, &coreFound, &coreDevice);
   *s = 77;
   print(coreX); print(coreY);
   printflush(message1);
   stop();
}
