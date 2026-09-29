/* EXPECT: 1 1 2 2 */
/* The byname MEMBER of a struct that lives in memory is still one name word:
   the width follows the member type, not the struct's location (t127). The
   store through the member still lands in the cell, whatever pragmas are
   applied. */
struct s2 { int *byname ptr; int n; };
volatile s2 n;
auto device message1;
void main() {
    extern int q;
    n.ptr = byname(&q);
    *(n.ptr) = 2;
    print(widthof(int *byname));
    print(widthof(struct s2));
    print(widthof(volatile struct s2));
    print(q);
    printflush(message1); stop();
}