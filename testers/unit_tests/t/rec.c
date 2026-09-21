auto device message1;
int rec(int n) { if (n <= 0) { return 0; } return n + rec(n - 1); }
void main() { print(rec(3)); printflush(message1); stop(); }
