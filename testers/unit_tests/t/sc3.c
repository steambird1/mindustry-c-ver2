auto device message1;
int g;
int t() { g = g + 1; return 0; }
int f() { g = g + 100; return 1; }
void main() {
    if (f() || t()) { print(1); } else { print(0); }
    print(g);
    printflush(message1); stop();
}
