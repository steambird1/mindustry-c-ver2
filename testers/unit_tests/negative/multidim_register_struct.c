/* MESSAGE: needs single-cell elements */
/*
A register/lookup array stores one cell per element. A struct element needs
several member registers, so a multidimensional struct array must use a
memory-backed layout instead.
*/
auto device message1;

struct P { int x; int y; };
struct P a[2][2] =
    array("embedded_divided", {{{1, 2}, {3, 4}}, {{5, 6}, {7, 8}}});

void main() {
    print(a[1][0].x);
    printflush(message1);
    stop();
}
