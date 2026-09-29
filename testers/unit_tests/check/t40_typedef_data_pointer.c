/* EXPECT: 5 */
/* A typedef'd data pointer has to remain a pointer. The old alias builder
   rebuilt `typedef int *p` from the base's name and size alone, dropping the
   pointerTo chain, so `p q; q = &x;` left `q` a plain int and either crashed
   the compiler or refused the assignment. */
auto device message1;
typedef int *p;
void main() {
    int x = 5;
    p q = &x;
    print(*q);
    printflush(message1); stop();
}