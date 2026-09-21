/* EXPECT: 4 */
/* `more()` has a side effect (it advances `i`) and sits in a while condition.
   If it were inlined and the loop computed statically, the count would be
   wrong -- so it stays a real call. */
auto device message1;
int i = 0;
int more() { i = i + 1; return i < 5; }
void main() {
    int c = 0;
    while (more()) { c = c + 1; }
    print(c);
    printflush(message1);
    stop();
}
