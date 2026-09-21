/* EXPECT: 5 7 */
/* A `return` in the middle cannot be reproduced (no goto), so such a function
   is NOT inlined -- it stays a real function and works. */
auto device message1;
int pick(int a) {
    if (a > 3) { return 7; }
    return 5;
}
void main() {
    print(pick(1));
    print(pick(9));
    printflush(message1);
    stop();
}
