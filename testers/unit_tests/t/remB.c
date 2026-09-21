/* The importing side. */
auto device processor1;
auto device message1;
extern int c;
remote int rs = remote(processor1, c);
void main() {
    rs = 42;
    print(rs);
    printflush(message1);
}
