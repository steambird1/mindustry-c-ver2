auto device message1;
int f(int x) { return x + 1; }
void main() { int i; for (i=0;i<2;i++) { print(f(i)); } printflush(message1); stop(); }
