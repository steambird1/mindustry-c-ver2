/* EXPECT: 12 */
/* Inlining a call inside a loop BODY is fine: the simulation re-analyses the
   body each round, so the loop can still be computed in full.

   The compiler must not fail here. An empty error list with a non-zero
   failure is the worst of both: it says "refused, and here is why" while
   giving no reason at all. If the optimiser walks off the end of its own
   usage map, that is a compiler bug, and it should be reported as one. */
auto device message1;
int twice(int x) { return x + x; }
void main() {
    int s = 0, i;
    for (i = 0; i < 4; i++) { s = s + twice(i); }
    print(s);
    printflush(message1);
    stop();
}
