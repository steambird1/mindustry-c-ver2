#pragma noinline(w)
auto device message1;
int w(int* p) { *p = 5; return 1; }
int q(int* p) { *p = 9; return 1; }
void main() { int a = 0; w(&a); q(&a); print(a); printflush(message1); stop(); }
