/* MESSAGE: multi-register register array cannot travel as a handle */
/*
A handle helper returns one register. A struct element is made of several
member registers, so this array needs a memory layout or an inlined call.
*/
#pragma noinline
auto device message1;

struct P { int x; int y; };
struct P a[1] = array("embedded_divided", {{1, 2}});

void show(struct P s[]) {
    print(s[0].x);
}

void main() {
    show(a);
    printflush(message1);
    stop();
}
