/*
A read-only handle is a VALUE that promises no writes: its set helper may not
exist at all, because a constant table has no cells. That is what lets a
constant table take part in a run-time choice:

    const int h[] = cond ? encodedTable : writableArray;

Reads, `lenof` and `sizeof` work through it; a write, a `veccpy` into it, or a
copy into a writable handle is a compile-time refusal (see the negatives).

The qualifier has to come from the declaration. `const int s[] = b;` is
read-only even though `b` is not, and `sizeof` on an alias is still the
array's own cell count.
*/
/* EXPECT: 4 3 1 1 3 7 3 4 3 1 3 */
auto device message1;

const int encoded[3] = array("encoded", {1, 2, 3});
int writable[3] = {4, 5, 6};
const int fixed[3] = {7, 8, 9};

void readOnly(const int s[]) {
    print(s[0]);
    print(lenof(s));
}

void main() {
    /* The encoded branch makes the whole handle read-only. */
    const int h[] = 0 ? encoded : writable;
    print(h[0]);
    print(lenof(h));
    print(sizeof(h));

    const int g[] = 1 ? encoded : writable;
    print(g[0]);
    print(lenof(g));

    /* A const alias of a writable array is a view; sizeof stays the array's. */
    const int s[] = fixed;
    print(s[0]);
    print(sizeof(s));

    /* A read-only handle goes where a read-only parameter is expected. */
    readOnly(h);
    readOnly(g);

    printflush(message1);
    stop();
}
