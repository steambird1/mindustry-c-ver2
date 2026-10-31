/* MESSAGE: Too many initializers for 'a' */
/* `char a[2] = "hi"` needs three cells: 'h', 'i' and the terminating NUL. */
auto device message1;
void main() {
    char a[2] = "hi";
    printflush(message1);
    stop();
}
