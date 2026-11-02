/* MESSAGE: Cannot assign memory for symbol a */
/*
No memory block: a struct array cannot fall back to the register layout,
because one struct is more than one cell.
*/
/* NOMEM */
auto device message1;

struct P { int x; int y; };
struct P a[2] = {{1, 2}, {3, 4}};

void main() {
    print(a[1].x);
    printflush(message1);
    stop();
}
