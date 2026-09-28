/* Must fail: an array has no single register to name, so `byname(&a[0])` cannot
   be honoured. */
auto device message1;
void main() {
    int a[2];
    int *byname p;
    p = &a[0];
    printflush(message1);
}
