/* Fully determined and never written at run time -> stored as a constant. */
auto device message1;
volatile int vi;
void main() {
    int a[4] = {5, 6, 7, 8};
    int i = vi;
    print(a[2]);      /* constant subscript -> literal */
    print(a[i]);      /* run-time subscript -> still works */
    printflush(message1);
    stop();
}
