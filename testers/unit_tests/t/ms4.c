/* EXPECT: 5 1 0 */
auto device message1;
auto device cell1;
void main() {
    write(5, cell1, 1);
    print(read(cell1, 1));
    print(stricteq(cell1, cell1));
    print(stricteq(cell1, null));
    printflush(message1); stop();
}
