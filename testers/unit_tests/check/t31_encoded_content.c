/* EXPECT: 1 9 3 0 */
/* An encoded array of contents: @lead, @silicon, @graphite and @copper are
   stored by their ids. */
auto device message1;
volatile int vi;
const int objs[4] = array("encoded", {@lead, @silicon, @graphite, @copper});
void main() {
    int i = vi;
    print(objs[i]);
    i = vi + 1;
    print(objs[i]);
    i = vi + 2;
    print(objs[i]);
    i = vi + 3;
    print(objs[i]);
    printflush(message1);
    stop();
}
