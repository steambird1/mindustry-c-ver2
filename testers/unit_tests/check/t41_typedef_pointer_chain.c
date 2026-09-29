/* EXPECT: 1 */
/* Typedefs nest: `typedef p *pp` makes a pointer to the pointer `p` meant. A
   chain that only carried the outer level's name and size turned `pp` into a
   plain `int`, so building `pp` crashed `createAliasType` outright. */
auto device message1;
typedef int *p;
typedef p *pp;
void main() {
    int x = 9;
    int *py = &x;
    pp q = &py;
    print(*q == py);
    printflush(message1); stop();
}