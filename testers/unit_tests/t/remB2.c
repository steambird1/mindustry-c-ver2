auto device processor1;
auto device message1;
extern int c;
remote int rs = remote(processor1, c);
remote int *p = remote(processor1, &c);
void main() {
    remote int *p2 = &rs;
    (*p) = 77;
    (*p2) = 88;
    print(rs);
    print(*p);
    printflush(message1);
}
