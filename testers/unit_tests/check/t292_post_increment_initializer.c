/*
An increment whose VALUE is used is a read as well as a write. The optimizer
used to count only the write, delete the declaration of `a`, and then delete
`a++` itself as an "unused assignment" -- leaving `b` uninitialised and
crashing when the initializer was nulled. Both global and local initializers
are covered here, as are postfix, prefix and decrement.
*/
/* EXPECT: 6 5 6 5 6 6 4 5 */
auto device message1;

int g = 5;
int h = g++;

void main() {
    print(g); print(h);

    int a = 5; int b = a++;
    print(a); print(b);

    int c = 5; int d = ++c;
    print(c); print(d);

    int e = 5; int f = e--;
    print(e); print(f);

    printflush(message1);
    stop();
}
