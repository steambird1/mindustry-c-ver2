/* MESSAGE: needs single-cell elements */
/*
A register array has one cell per element. A struct needs several member
registers, so it has to use the memory layout.
*/
auto device message1;

struct P { int x; int y; };
struct P a[2] = array("embedded_divided", {{1, 2}, {3, 4}});

void main() {
    print(a[0].x);
    printflush(message1);
    stop();
}
