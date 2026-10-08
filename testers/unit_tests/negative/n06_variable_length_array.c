/* MESSAGE: Variable length arrays are not supported: the size of 'a' must be a co */
/* A variable length array cannot be supported: the stack frame size is fixed
   at compile time. This used to be a warning and then silently behave as if
   the size were 1. */
auto device message1;
void f(int n) { int a[n]; a[0] = 1; print(a[0]); }
void main() { f(4); printflush(message1); stop(); }
