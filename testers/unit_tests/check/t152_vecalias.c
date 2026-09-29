/*
`vecalias(&a, b)` is the binding `a = b;` written as an intrinsic, and the `&`
is not decoration: a handle is ONE register, so the address of a handle is an
ordinary one-word name pointer, the cheapest thing that can carry it, and the
body is a single store.

The EMITs say that. `set g:.a <get helper>` is the pack writing straight into
the cell -- no temporary, no second store -- and the `op or` that folds in the
constant length/size tail is allowed, so the shape asserted is "one store into
the cell, no pack into anything else". A `vecalias` that bound the temporary
the `&` produced (as a first cut did) would pass the value check and fail this:
the write went to a copy that nobody reads.
*/
/* EXPECT: 7 7 5 */
/* EMIT: set g:\.a ___arrget */
/* EMIT-NOT: set g:\.f:[^ ]*\.a */
/* EMIT: op or g:\.a g:\.a \d+ */
auto device message1;
int mem[5] = {10, 11, 12, 13, 14};
int a[];
void main() {
    vecalias(&a, mem);
    a[1] = 7;
    print(a[1]);
    print(mem[1]);
    print(lenof(a));
    printflush(message1);
    stop();
}
