// This won't cause error in older versions when the resolution of CV-qualifiers
// are incorrect. However, when accessing array in this case, problem occurs.

struct tmp {
   int *w;
};

struct tmp s;

void main() {
   
   int r;
   s.w = &r;
}