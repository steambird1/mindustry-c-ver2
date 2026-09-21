auto device message1;
int c = 5;
void main(){ int *s = byname(&c); (*s) = 9; print(*s); printflush(message1); }
