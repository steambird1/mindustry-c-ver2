auto device processor1;
auto device message1;
int u[6] = {1, 2, 3, 4, 5, 6};
remote int ru[] = remote(processor1, u);
void main() {
    int i = 4;
    ru[0] = 100;
    print(ru[0]);
    print(ru[i]);
    printflush(message1);
}
