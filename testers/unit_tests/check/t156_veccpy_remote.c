/*
`veccpy` writes ELEMENTS, and an element does not have to live here. A remote
array's elements are registers of another processor, and a `write` through the
building that holds them is an ordinary instruction -- so a remote destination
works, and copying out of one works too.

This is the property that separates the two intrinsics, and it is worth a test
of its own: `vecalias` refuses exactly these arrays (`vecalias_remote_source.c`
and `vecalias_into_storage.c`), because a handle packs helper entry points of
THIS processor and a name does not travel. `veccpy` never packs anything, so
where the elements live is not its business.

`print(r[0])` is the discriminating line. `r` and `ra` name the SAME registers,
so reading the one under its local name after writing through the remote one
is what shows the element really moved rather than landing in a copy.
*/
/* EXPECT: 9 6 8 9 8 7 6 */
auto device message1;
extern int r[4] = {1, 2, 3, 4};
remote int ra[4] = remote(@this, r);
int src[4] = {9, 8, 7, 6};
void main() {
    veccpy(ra, src);
    print(r[0]);
    print(r[3]);
    print(ra[1]);
    src[0] = 1;
    src[1] = 1;
    veccpy(src, ra);
    print(src[0]);
    print(src[1]);
    print(src[2]);
    print(src[3]);
    printflush(message1);
    stop();
}
