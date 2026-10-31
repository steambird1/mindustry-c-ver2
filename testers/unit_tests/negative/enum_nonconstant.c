/* MESSAGE: needs a constant expression */
/* Enumerator initializers must be compile-time integer constants. */
auto device message1;
enum { A = unknown_value };
void main() {
    print(A);
    printflush(message1);
    stop();
}
