#pragma optimize(pointer)
void oper(int *x) { (*x) = 20; }
void main() {
   int coreX, coreY, coreFound;
   device coreDevice;
   oper(&coreX);
   ulocate("building", "core", true, &coreX, &coreY, &coreFound, &coreDevice);
}
