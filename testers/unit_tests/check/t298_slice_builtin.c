/*
`slice(x, start[, end])` is the explicit view form: a handle whose first
element is `x[start]` and whose length is `end - start` (or "to the end" when
`end` is omitted).

It is defined on the element SEQUENCE, not on an address, so it is the form
that works for a memory array, for a handle and for an `embedded` register
array alike. The packed handle carries the start offset; every access adds it
to the index, which is what `op shr ... 40` below unpacks.

The bound is a run-time value in the second part of the test: the length is
computed when the handle is built, not when the program is compiled.
*/
/* EXPECT: 3 20 40 99 3 99 3 40 3 20 3 99 3 99 20 3 4 7 */
/* EMIT: op shr \S+ \S+ 40 */
auto device message1;

int a[6] = {10, 20, 30, 40, 50, 60};
int w[6] = {1, 2, 3, 4, 5, 6};

void show(int s[]) {
    print(lenof(s));
    print(s[0]);
}

void main() {
    /* A closed range. */
    int b[] = slice(a, 1, 4);
    print(lenof(b));
    print(b[0]);
    print(b[2]);

    /* Writing through the view writes into the root. */
    b[1] = 99;
    print(a[2]);

    /* A run-time start: the length is packed at run time. */
    int i = 2;
    int c[] = slice(a, i, 5);
    print(lenof(c));
    print(c[0]);

    /* Omitting the end runs to the end of the array. */
    int t[] = slice(a, 3);
    print(lenof(t));
    print(t[0]);

    /* A conditional chooses between two views at run time. */
    int d[] = 1 ? slice(a, 1, 4) : slice(a, 2, 5);
    print(lenof(d));
    print(d[0]);

    /* The same through the intrinsic binding form. */
    int h[];
    vecalias(&h, slice(a, 2, 5));
    print(lenof(h));
    print(h[0]);

    /* Handing a view to an array parameter, and indexing one directly. */
    show(slice(a, 2, 5));
    print(slice(a, 1, 4)[0]);
    print(sizeof(slice(a, 1, 4)));

    /* A run-time bound: the length is asked for at run time, not folded. */
    print(lenof(slice(a, i)));

    /* An ALIAS as the root: a write through the view must reach the array the
       alias names, not a constant copy of it. */
    int alias[] = w;
    int k[] = slice(alias, 1, 4);
    k[0] = 7;
    print(w[1]);
    printflush(message1);
    stop();
}
