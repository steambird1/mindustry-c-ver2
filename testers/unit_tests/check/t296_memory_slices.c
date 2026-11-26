/*
A SLICE of a memory array is the array's own helper plus the element it
starts at. The packed handle carries that start in its top field, so a slice
can be stored, copied and rebound like any other handle -- but the helper is
shared by every slice of the same array, which is what keeps

    int b[] = g[i];
    int c[] = g[j];

from emitting two copies of the get / set helpers.

Two forms are covered: taking dimensions off a multi-dimensional array
(`g[i]`, flattened to one dimension) and a pointer tail (`&a[i]`, `a + i`,
which runs to the end of the array).
*/
/* EXPECT: 4 3 9 1 3 40 4 30 9 3 9 1 3 9 2 50 3 1 12 9 */
/* EMIT: op shr \S+ \S+ 40 */
auto device message1;

int g[2][3] = {{1, 2, 3}, {4, 5, 6}};
int a[6] = {10, 20, 30, 40, 50, 60};
int g3[2][3][4];

void show(int s[]) {
    print(lenof(s));
    print(s[0]);
}

void main() {
    /* One dimension off a 2-D array: a row. */
    int b[] = g[1];
    print(b[0]);
    print(lenof(b));
    b[0] = 9;
    print(g[1][0]);

    /* The same with a run-time index. */
    int i = 0;
    int c[] = g[i];
    print(c[0]);

    /* A pointer tail: from the element to the end of the array. */
    int t[] = &a[3];
    print(lenof(t));
    print(t[0]);

    /* ... and the same through pointer arithmetic, with a run-time start. */
    int j = 2;
    int u[] = a + j;
    print(lenof(u));
    print(u[0]);

    /* A conditional chooses between two slices at run time. */
    int d[] = 0 ? g[0] : g[1];
    print(d[0]);
    print(lenof(d));

    /* The offset rides in the value, so a copy keeps pointing where it did
       even after the source is rebound. */
    int h[];
    h = g[1];
    int k[] = h;
    h = g[0];
    print(k[0]);
    print(h[0]);

    /* Handing a slice to an open-dimension parameter. */
    show(g[1]);
    show(&a[4]);

    /* ... and a conditional slice, chosen at run time. */
    show(1 ? g[0] : g[1]);

    /* Several dimensions at once are flattened into one. */
    g3[1][0][0] = 9;
    int flat[] = g3[1];
    print(lenof(flat));
    print(flat[0]);

    printflush(message1);
    stop();
}
