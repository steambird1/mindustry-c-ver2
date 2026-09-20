auto device message1;
volatile int vi;
struct pair { int a; int b; };
struct pair ps[3];
int grid[3][4];
union u { int i; int j; };
void main() {
    int r = vi;
    int c = 2;
    grid[r][c] = 7;
    print(grid[r][c]);
    ps[1].a = 4;
    ps[r].b = 5;
    print(ps[1].a);
    print(ps[0].b);
    union u w;
    w.i = 3;
    print(w.j);
    printflush(message1);
    stop();
}
