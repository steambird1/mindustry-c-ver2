/* MESSAGE: A compound literal for 'int' needs exactly one value */
/* A scalar compound literal has a single value; a list is not a struct. */
auto device message1;

void main() {
    print((int){1, 2});
    printflush(message1);
    stop();
}
