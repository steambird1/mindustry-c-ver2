/* EXPECT: 20 261 11 56 */
/* @itemCount and friends fold to the table lengths when nothing was declared */
auto device message1;
void main() {
    print(@itemCount);
    print(@blockCount);
    print(@liquidCount);
    print(@unitCount);
    printflush(message1);
    stop();
}
