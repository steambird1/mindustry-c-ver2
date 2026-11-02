/* MESSAGE: Too many initializers */
/* The declared array length bounds the number of initializer values. */
auto device message1;

void main() {
    print((int[2]){1, 2, 3}[0]);
    printflush(message1);
    stop();
}
