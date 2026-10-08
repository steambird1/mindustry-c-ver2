/* MESSAGE: A 'remote' array can only have one dimension: its elements are single  */
/* Must fail: the elements of a remote array are single registers of the other
   processor, so there is no shape for a second dimension. */
auto device message1;
extern int u[2][3];
remote int ru[2][3] = remote(@this, "g:.u");
void main() {
    ru[1][2] = 7;
    print(u[1][2]);
    printflush(message1);
}
