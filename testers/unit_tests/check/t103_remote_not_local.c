/* EXPECT: 5 42 */
/* `remote(processor1, c)` is the variable c ON THAT PROCESSOR -- not this
   program's own `c`, even though one is declared here under the same name.
   A declaration here is only a description of the type over there. */
// PEER: processor1=peers/t103.peer.c
auto device processor1;
auto device message1;
int c = 5;
remote int rc = remote(processor1, c);
void main() {
    rc = 42;
    print(c);
    print(rc);
    printflush(message1); stop();
}
