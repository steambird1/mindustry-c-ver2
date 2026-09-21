#pragma optimize(pointer)
auto device message1;
int c = 5;
void main(){ int *s = byname(&c); (*s) = 7; print(*s); printflush(message1); stop(); }
