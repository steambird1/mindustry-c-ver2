/* EXPECT: 55 */
/* A remote pointer may point at THIS processor: `remote int *pself = ss`
   where ss is a byname() pointer. Writing through it writes the real c. */
auto device message1;
extern int c;
int *ss = byname(&c);
void main() {
    remote int *pself = ss;
    (*pself) = 55;
    print(c);
    printflush(message1);
}
