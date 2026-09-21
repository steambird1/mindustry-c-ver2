#pragma noinline
auto device message1;
inline int w(int* p) { *p = 5; return 1; }
void main() { int a = 0; w(&a); print(a); printflush(message1); stop(); }
