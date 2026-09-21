/* EXPECT: 5 6 3 1 */
/* lenof of a multi-dimensional array gives the OUTERMOST dimension; lenof of
   an element asks about that element's own type, so `a[1]` of `int a[5][6]`
   is `int[6]` and gives 6. */
auto device message1;
int a[5][6];
int b[3];
int i;
void main() {
    print(lenof(a));
    print(lenof(a[1]));
    print(lenof(b));
    print(sizeof(b) / lenof(b));
    printflush(message1); stop();
}
