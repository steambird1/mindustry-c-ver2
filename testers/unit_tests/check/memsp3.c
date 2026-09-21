auto device message1;
auto device bank1;
void main() {
    int x = read(bank1, 5);
    write(77, bank1, 5);
    int y = read(bank1, 5);
    print(y);
    print(stricteq(bank1, bank1));
    print(stricteq(bank1, null));
    printflush(message1);
    stop();
}
