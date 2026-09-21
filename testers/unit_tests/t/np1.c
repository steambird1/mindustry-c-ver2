#pragma optimize(pointer)
auto device message1;
int s;
void main(){ int *p = &s; (*p) = 7; print(*p); printflush(message1); stop(); }
