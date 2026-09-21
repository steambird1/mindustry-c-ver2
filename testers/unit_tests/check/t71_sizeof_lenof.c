/* EXPECT: 1 4 2 2 6 4 2 1 */
/* sizeof/lenof: int=1, int[4]=4, pointer=2, struct pt=2, int[2][3]=6, lenof(int[4])=4, lenof(int[2][3]) is the OUTERMOST dimension (2), int=1. */
auto device message1;
struct pt { int x; int y; };
struct pt p;
int *q;
int a[4];
int m[2][3];
void main() {
    print(sizeof(int));
    print(sizeof(a));
    print(sizeof(q));
    print(sizeof(struct pt));
    print(sizeof(m));
    print(lenof(a));
    print(lenof(m));
    print(sizeof(p) / 2);
    printflush(message1); stop();
}
