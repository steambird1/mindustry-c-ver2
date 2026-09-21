/* EXPECT: 5 */
/* A function with side effects can still be INLINED -- purity is a separate
   question (it only decides whether an unused call may be deleted). */
auto device message1;
int w(int* p) { *p = 5; return 1; }
void main() { int a = 0; w(&a); print(a); printflush(message1); stop(); }
