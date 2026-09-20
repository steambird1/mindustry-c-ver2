/* array("embedded_divided"): one register per element, picked with select. */
auto device message1;
volatile int vi;
int a[4] = array("embedded_divided", {3, 4, 5, 6});

void main() {
    int i = vi;
    print(a[i]);
    a[i] = 42;
    print(a[i]);
    print(a[0]);
    printflush(message1);
    stop();
}
