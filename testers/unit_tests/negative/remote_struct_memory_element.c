/* MESSAGE: A remote array must keep its elements in registers */
/*
A struct containing an ordinary pointer (or an array/union) needs the memory
layout. Remote arrays address registers by name, so such an element cannot be
published.
*/
auto device message1;

struct S { int *p; int n; };
extern struct S u[2];

remote struct S r[2] = remote(@this, u);

void main() {
    print(r[0].n);
    printflush(message1);
    stop();
}
