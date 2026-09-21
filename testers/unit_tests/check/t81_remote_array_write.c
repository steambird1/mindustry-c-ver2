/* EXPECT: 99 30 */
/* Writing through a remote array changes the real element. */
auto device message1;
int u[4] = {10, 20, 30, 40};
remote int ru[] = remote(@this, u);
void main() {
    ru[1] = 99;
    print(u[1]);
    print(u[2]);
    printflush(message1);
}
