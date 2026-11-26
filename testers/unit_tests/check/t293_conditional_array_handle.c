/*
A conditional over arrays is a runtime HANDLE: the chosen branch's packed
get/set helpers, length and element size all travel in one cell. The branches
do not have to have the same length -- `lenof` then comes from the handle at
run time -- and a handle can also be copied or chosen by another handle.

`sizeof` answers the size of the VALUE, so a runtime handle is one cell even
when it names a longer array. A compile-time alias would keep the array's own
length, but none of the bindings below is one.
*/
/* EXPECT: 1 5 1 42 6 3 1 2 1 6 3 1 5 42 8 2 1 */
auto device message1;

int a[5] = {1, 2, 3, 4, 5};
int c[3] = {6, 7, 8};

/* An open-dimension parameter is itself a handle, so its declaration form is
   a handle copy too -- this used to be refused as "neither says how many". */
void use(int s[]) {
    int t[] = s;
    print(t[1]);
    print(sizeof(t));
}

void main() {
    /* Same layout, different lengths: the conditional handle keeps the length
       it actually chose at run time. */
    int b[] = 1 ? a : c;
    print(b[0]);
    print(lenof(b));
    print(sizeof(b));
    b[2] = 42;
    print(a[2]);

    int d[] = 0 ? a : c;
    print(d[0]);
    print(lenof(d));
    print(sizeof(d));

    /* Handle to handle: `int e[] = h;` copies the packed value, just like
       `e = h;` would. */
    int h[]; h = a;
    int e[] = h;
    print(e[1]);
    print(sizeof(e));

    /* Conditional between two runtime handles. */
    int f[]; f = 0 ? h : d;
    print(f[0]);
    print(lenof(f));

    /* Mixed branch: a concrete array on one side, a handle on the other. */
    f = 1 ? a : d;
    print(f[0]);
    print(lenof(f));

    print(a[2]);
    print(c[2]);

    use(a);

    printflush(message1);
    stop();
}
