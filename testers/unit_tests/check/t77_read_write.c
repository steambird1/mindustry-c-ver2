/* EXPECT: 77 1 0 */
/* `read` / `write` talk to a memory building by name -- including one that is
   not linked to this processor. `stricteq` is the strict comparison. */
// DEVICES: ext1=memory
auto device message1;
auto device ext1;

void main() {
    write(77, ext1, 5);
    int v = read(ext1, 5);
    print(v);
    print(stricteq(ext1, ext1));
    print(stricteq(ext1, null));
    printflush(message1);
}
