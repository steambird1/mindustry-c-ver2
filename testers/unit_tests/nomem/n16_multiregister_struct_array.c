/*
With no memory, a multi-register struct array must fall back to
embedded_divided; it cannot use one lookup name for several registers.
*/
/* EXPECT: 5 3 4 */
auto device message1;

struct S {
    int x;
    int a:3;
    int b:4;
};

extern struct S a[2];

void main() {
    a[1].x = 5;
    a[1].a = 3;
    a[1].b = 4;
    print(a[1].x);
    print(a[1].a);
    print(a[1].b);
    printflush(message1);
    stop();
}
