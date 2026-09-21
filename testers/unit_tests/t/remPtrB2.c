auto device processor1;
auto device message1;
int *remote q = remote(processor1, "g:.qq2");
void main() {
    (*q) = 33;
    print(1);
    printflush(message1);
}
