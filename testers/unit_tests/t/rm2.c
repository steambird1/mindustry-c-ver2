auto device processor1;
auto device message1;
extern int c;
remote int rs = remote(processor1, c);
remote int *p = remote(processor1, &c);
void main() {
    rs = 42;
    (*p) = 77;
    print(rs);
    print(*p);
    printflush(message1);
    stop();
}
