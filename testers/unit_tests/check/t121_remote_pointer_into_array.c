/* EXPECT: 9 9 */
/* A pointer to ONE ELEMENT of a remote array: `&ru[2]` is the name of that
   element together with the processor, so writing through it lands in the
   array on the other side. */
auto device message1;
extern int u[4] = array("embedded_divided");
remote int ru[4] = remote(@this, "g:.u", "embedded_divided");
void main() {
    remote int *p = &ru[2];
    (*p) = 9;
    print(u[2]);
    print(ru[2]);
    printflush(message1); stop();
}
