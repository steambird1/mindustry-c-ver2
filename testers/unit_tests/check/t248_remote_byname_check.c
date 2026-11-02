/*
Storing a local `byname` pointer into a self-remote struct element passes the
default runtime device check: both sides are @this.
*/
/* EXPECT: 7 */
auto device message1;

int x = 7;

struct P { int *byname p; int n; };
struct P u[1] = array("embedded_divided", {{byname(&x), 1}});
remote struct P r[1] = remote(@this, u);

void main() {
    r[0].p = byname(&x);
    print(*r[0].p);
    printflush(message1);
    stop();
}
