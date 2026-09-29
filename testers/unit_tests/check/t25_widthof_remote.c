/* EXPECT: 1 1 2 1 */
/* A remote variable is a HANDLE -- one register carrying a processor id and
   a name -- so remote does not scale array widths, it reduces them:
   widthof(remote int[4]) is 1 where the same array in memory would be 2,
   and widthof(remote int) is the same 1 as any scalar. */
auto device message1;
void main() {
    print(widthof(remote int[4]));
    print(widthof(remote int));
    print(widthof(int[4]));
    print(widthof(int));
    printflush(message1); stop();
}