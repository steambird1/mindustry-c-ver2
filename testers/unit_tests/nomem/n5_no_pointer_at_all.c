/* EXPECT: 2 3 */
/* A program that uses no pointer at all needs no memory block either: nothing
   about the missing memory should be reported when nothing is missing. */
auto device message1;
void main() {
    int a = 2;
    int b = 3;
    print(a);
    print(b);
    printflush(message1);
}
