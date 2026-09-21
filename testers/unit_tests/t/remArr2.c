auto device processor1;
auto device message1;
int u[4] = {10, 20, 30, 40};
remote int ru[] = remote(processor1, u);
void main() {
    int i = 2;
    ru[1] = 99;
    print(ru[3]);
    print(ru[i]);
    printflush(message1);
}
