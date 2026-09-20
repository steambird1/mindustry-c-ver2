/* EXPECT: 1 9 3 0 */
/* embedded_lookup holds contents too: the elements are registers named after
   the content constants, and they must be filled in. */
auto device message1;
volatile int vi;
const int ids[4] = array("embedded_lookup", {@lead, @silicon, @graphite, @copper});
void main() {
    int i = vi;
    print(ids[i]);
    i = vi + 1;
    print(ids[i]);
    i = vi + 2;
    print(ids[i]);
    i = vi + 3;
    print(ids[i]);
    printflush(message1);
    stop();
}
