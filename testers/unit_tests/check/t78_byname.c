/* EXPECT: 9 */
/* byname(&c) asks for the "holds a name" pointer representation explicitly,
   so it works without #pragma optimize(pointer). */
auto device message1;
int c = 5;
void main() {
    int *s = byname(&c);
    (*s) = 9;
    print(*s);
    printflush(message1);
}
