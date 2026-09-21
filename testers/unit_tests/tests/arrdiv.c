auto device message1;
volatile int vi;
int a[4] = array("embedded_divided", {3, 4, 5, 6});
void main() {
    int i = vi;
    print(a[i]);
    a[i] = 42;
    print(a[i]);
    printflush(message1);
    stop();
}
