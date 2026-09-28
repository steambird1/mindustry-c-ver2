/* EXPECT: 9 */
/* A GLOBAL target, asked for by name: it is not put in memory, and neither
   `z.__pointer_block` nor `z.__pointer_pos` is ever assigned. */
auto device message1;
int z = 7;
void main() {
    int *byname s = &z;
    (*s) = 9;
    print(z);
    printflush(message1);
}
