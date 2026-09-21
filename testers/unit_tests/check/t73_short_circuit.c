/* EXPECT: 1 2 0 100 1 1000 */
/* && and || must not evaluate the right side when the left one decides. `f()` returns 0 and adds 100; `t()` adds 1 and must NOT run. */
auto device message1;
int g;
int t() { g = g + 1; return 1; }
int f() { g = g + 100; return 0; }
int u() { g = g + 1000; return 1; }
void main() {
    g = 0;
    if (t() && t()) { print(1); } else { print(0); }
    print(g);
    g = 0;
    if (f() && t()) { print(1); } else { print(0); }
    print(g);
    g = 0;
    if (u() || t()) { print(1); } else { print(0); }
    print(g);
    printflush(message1); stop();
}
