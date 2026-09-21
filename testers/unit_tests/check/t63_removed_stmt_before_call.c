/* EXPECT: 6 */
/* A statement dropped by constant folding used to make the analyzer skip the
   statement after it (it iterated the live array while `replaceNode` spliced
   it), so the call below was never seen, the call graph stayed empty, and every
   function but main was deleted. */
auto device message1;
const int never = 0;
int g = 1;
void work() { g = g + 5; }
void main() {
    if (never) { print(0); }
    work();
    print(g);
    printflush(message1);
    stop();
}
