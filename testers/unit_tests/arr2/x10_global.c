/* Global array, never touched by a call: folds like a local one. */
auto device message1;
int g[3] = {7, 8, 9};
int bump(int v) { return v + 1; }
void main() {
    print(g[0] + g[2]);   /* 16 */
    print(bump(g[1]));    /* call invalidates g afterwards */
    print(g[1]);          /* read through memory */
    printflush(message1);
    stop();
}
