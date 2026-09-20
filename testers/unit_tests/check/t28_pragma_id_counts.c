/* EXPECT: 300 */
/* declaring an id by hand makes the counts unknown, so they are read at run
   time instead of being folded */
#pragma id(item, @myitem:300)
auto device message1;
void main() {
    print((int)@myitem);
    printflush(message1);
    stop();
}
