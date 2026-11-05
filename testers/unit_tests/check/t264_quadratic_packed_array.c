/*
Automatic constant arrays do not always need a string table:
  - {0,1,4,9,16} is i*i;
  - {0,255,10,200,3} fits five 8-bit fields in one safe integer.
An explicit array("encoded", ...) is still a table; see t30.
*/
/* EXPECT: 16 3 */
/* EMIT: op mul [^ ]+ ([^ ]+) \1 */
/* EMIT: op shr [^ ]+ \d+ [^ ]+ */
/* EMIT: op and [^ ]+ [^ ]+ 255 */
/* EMIT-NOT: read [^ ]+ "\$ */
auto device message1;
volatile int i;
const int squares[5] = {0,1,4,9,16};
const int packed[5] = {0,255,10,200,3};

void main() {
    i = (int)@thisx + 4;
    print(squares[i]);
    print(packed[i]);
    printflush(message1);
    stop();
}
