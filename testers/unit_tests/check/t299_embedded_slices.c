/*
An `embedded` array keeps one register per element, so it has no address --
but a HANDLE is an index into a sequence, and that is exactly what the
generated helper does (`select` over the element registers).

So the two view forms that are defined on the sequence work:
    e[i]          one dimension taken off a multi-dimensional array
    slice(e, s, e)  an explicit range

The address forms (`&e[i]`, `e + i`) stay refused: there is nothing to step.
*/
/* EXPECT: 3 4 40 3 20 99 3 40 3 1 3 40 3 1 */
/* EMIT: op shr \S+ \S+ 40 */
auto device message1;

int e[2][3] = array("embedded", {{1, 2, 3}, {4, 5, 6}});
int flat[6] = array("embedded", {10, 20, 30, 40, 50, 60});

void show(int s[]) {
    print(lenof(s));
    print(s[0]);
}

void main() {
    /* A row: the remaining dimension is flattened to one. */
    int row[] = e[1];
    print(lenof(row));
    print(row[0]);

    /* Writing through the row reaches the root's register. */
    row[0] = 40;
    print(e[1][0]);

    /* An explicit range over the flattened registers. */
    int part[] = slice(flat, 1, 4);
    print(lenof(part));
    print(part[0]);
    part[1] = 99;
    print(flat[2]);

    /* A run-time row index. */
    int i = 1;
    int chosen[] = e[i];
    print(lenof(chosen));
    print(chosen[0]);

    /* Views travel to an array parameter like any other handle. */
    show(e[0]);
    show(slice(flat, 3));

    /* A conditional chooses between two rows at run time. */
    int d[] = 1 ? e[0] : e[1];
    print(lenof(d));
    print(d[0]);
    printflush(message1);
    stop();
}
