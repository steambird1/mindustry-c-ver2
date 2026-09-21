auto device processor1;
auto device message1;
int u[5];
remote int ru[] = remote(processor1, u);
void main() {
    print(ru[2]);
    printflush(message1);
}
