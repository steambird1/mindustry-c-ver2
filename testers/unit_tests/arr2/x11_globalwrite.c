/* A function that really does write the global: the read afterwards MUST NOT
   be folded to the initial value. */
auto device message1;
int g[3] = {7, 8, 9};
void changer() { g[1] = 100; }
void main() {
    changer();
    print(g[1]);       /* must be 100 at run time, not 8 */
    printflush(message1);
    stop();
}
