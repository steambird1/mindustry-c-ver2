/* EXPECT: 7 */
/* A function pointer is a value (a line number), and a parameter that has an
   address keeps travelling as one -- so it survives an indirect call. */
auto device message1;
typedef void (*cb)(int*);
void test(int *p) { (*p) = 7; }
void main() {
    int a = 0;
    cb f = test;
    f(&a);
    print(a);
    printflush(message1); stop();
}
