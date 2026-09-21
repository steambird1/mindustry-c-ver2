auto device message1;
extern int c;
int *ss = byname(&c);
void main() {
    remote int *pself = ss;
    (*pself) = 55;
    print(c);
    printflush(message1);
}
