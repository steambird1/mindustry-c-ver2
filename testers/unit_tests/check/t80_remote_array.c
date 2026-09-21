/* EXPECT: 40 30 */
/* A remote array: every element is a register of the other processor. */
auto device message1;
int u[4] = {10, 20, 30, 40};
remote int ru[] = remote(@this, u);
void main() {
    int i = 2;
    print(ru[3]);
    print(ru[i]);
    printflush(message1);
}
