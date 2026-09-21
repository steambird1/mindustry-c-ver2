/* EXPECT: 12 */
/* Inlining inside the loop BODY is fine: the simulation re-analyses the body
   on every round, so the loop can still be computed in full. */
auto device message1;
int twice(int x) { return x + x; }
void main() {
    int s = 0, i;
    for (i = 0; i < 4; i++) { s = s + twice(i); }
    print(s);
    printflush(message1);
    stop();
}
