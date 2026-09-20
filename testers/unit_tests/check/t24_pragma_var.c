/* EXPECT: 5 3 */
/* #pragma var declares a processor variable, like @this */
#pragma var(int, @myVar)
auto device message1;
void main() {
    int a = @myVar;
    print(a + 5);
    int b = 3;
    print(b);
    printflush(message1);
    stop();
}
