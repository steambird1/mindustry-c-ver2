/* MESSAGE: Dynamic subscript of a multi-register register array */
/*
A struct element occupies several member registers; a dynamic subscript cannot
select a whole struct with one `select`. Use a constant index or memory.
*/
#pragma noinline
auto device message1;

struct P { int x; int y; };
struct P a[2] = array("embedded_divided", {{1, 2}, {3, 4}});

void readAt(int i) {
    print(a[i].x);
}

void main() {
    readAt(1);
    printflush(message1);
    stop();
}
