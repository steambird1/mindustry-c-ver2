// This won't cause error in older versions when the resolution of CV-qualifiers
// are incorrect. However, when accessing array in this case, problem occurs.

volatile near int w[5];

void main() {
    w[3] = 1;
}