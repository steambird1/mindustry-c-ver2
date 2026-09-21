/* EXPECT: 6 */
/* A call in the loop CONDITION is never inlined: the loop simulator counts
   iterations by evaluating the condition, without running what it does. */
auto device message1;
int getn() { return 4; }
void main() {
    int total = 0, i;
    for (i = 0; i < getn(); i++) { total = total + i; }
    print(total);
    printflush(message1);
    stop();
}
