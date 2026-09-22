/* EXPECT: 0 0 0 */
auto device message1;
auto device cell1;
void main() {
    device d = getlink(0);
    print(stricteq(d, cell1));
    print(stricteq(null, 0));
    print(stricteq(null, cell1));
    printflush(message1); stop();
}
