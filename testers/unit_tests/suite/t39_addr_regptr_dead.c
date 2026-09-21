#pragma optimize(pointer)

void main() {
   int coreX, coreY, coreFound;
   device coreDevice;

   int *s = &coreX;

   ulocate("building", "core", true, &coreX, &coreY, &coreFound, &coreDevice);
}
