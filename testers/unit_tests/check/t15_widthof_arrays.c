/* EXPECT: 2 2 2 1 1 */
/* An array in memory is two words (block + offset), in any number of
   dimensions. An OPEN dimension is a HANDLE: a single register holding the
   array's name. */
auto device message1;
void main() {
    print(widthof(int[4]));
    print(widthof(int[3][2]));
    print(widthof(char[5]));
    print(widthof(int[]));
    print(widthof(char[]));
    printflush(message1); stop();
}