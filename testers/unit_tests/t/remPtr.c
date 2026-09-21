auto device processor1;
auto device message1;
int c = 5;
int *qq = &c;
int *remote q = remote(processor1, qq);
void main() {
    (*q) = 33;
    print(c);
    printflush(message1);
}
