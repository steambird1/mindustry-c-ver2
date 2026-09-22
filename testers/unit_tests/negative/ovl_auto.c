/* An `auto` parameter asks for one version of the function per representation
   of the argument -- that is function overloading, which does not exist yet,
   so it has to be refused rather than silently compiled. */
void test(auto int *s) { (*s) = 7; }
void main() { int a = 0; test(&a); }
