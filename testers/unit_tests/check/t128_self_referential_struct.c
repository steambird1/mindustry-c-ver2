/* EXPECT: 1 2 */
/* `struct node { int v; struct node *next; }` -- a struct that points at itself.
   The name has to be known while the members are still being read, and the
   pointer has to see the FINISHED type (a snapshot taken mid-definition is
   empty, so `->v` would read at the wrong offset). */
auto device message1;
struct node { int v; struct node *next; };
struct node a; struct node b;
void main() {
    a.v = 1; b.v = 2;
    a.next = &b;
    print(a.v);
    print(a.next->v);
    printflush(message1); stop();
}
