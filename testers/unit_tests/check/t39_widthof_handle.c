/* EXPECT: 1 1 */
/* An unsized array PARAMETER is a handle -- one register holding the array's
   name; the sized argument in memory stays two words. widthof answers the
   HANDLE width of the parameter, not the argument's. */
auto device message1;
void f(int a[]) {
    print(widthof(a));
    print(widthof(int []));
}
void main() {
    int b[4];
    f(b);
    printflush(message1); stop();
}