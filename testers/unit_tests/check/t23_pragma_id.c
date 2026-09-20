/* EXPECT: 300 111 1 */
/* #pragma id wins over the built-in table */
#pragma id(item, @myitem:300)
#pragma id(item, @copper:111)
auto device message1;
void main() {
    print((int)@myitem);
    print((int)@copper);
    print((int)@lead);
    printflush(message1);
    stop();
}
