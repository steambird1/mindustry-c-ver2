/* EXPECT: 2 */
/* The same member in a struct that lives in MEMORY: the name is read out of the
   struct first, and only then is it a name pointer. */
/* EMIT-NOT: write 2 __curb g:\S*n\.ptr_pos */
#pragma optimize(pointer)
auto device message1;
struct s2 { int *byname ptr; int n; };
volatile s2 n;
void main() {
    extern int q;
    n.ptr = byname(&q);
    *(n.ptr) = 2;
    print(q);
    printflush(message1); stop();
}
