/* EXPECT: 1 2 1 */
/* widthof(x) of a VARIABLE reads its declared type: the expression form and
   the type-name form must agree. */
auto device message1;
void main() {
    int *byname p;
    int a[4];
    print(widthof(p));
    print(widthof(a));
    print(widthof(2));
    printflush(message1); stop();
}