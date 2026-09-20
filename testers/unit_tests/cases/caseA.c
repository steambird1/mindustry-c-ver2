auto device message1;
void main() {
   int coreX, coreY, coreFound;
   device coreDevice;
   ulocate("building", "core", true, &coreX, &coreY, &coreFound, &coreDevice);
   print(coreX); print(coreY); print(coreFound); print(coreDevice);
   printflush(message1);
   stop();
}
