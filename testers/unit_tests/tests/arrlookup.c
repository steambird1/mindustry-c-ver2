auto device message1;
volatile int vi;
int a[5] = array("embedded_lookup");
void main() {
    int i = vi;
    a[i] = 77;
    print(a[i]);
    printflush(message1);
    stop();
}
