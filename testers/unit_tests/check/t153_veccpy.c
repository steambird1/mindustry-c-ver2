/*
`veccpy(a, b)` is an element loop, and the loop is the point: it is the same
loop whichever layouts the two sides have, because both go through the same
`element(i)` machinery a subscript uses. Writing one loop per layout would be
two loops to keep in step, and one of them would rot.

The EMITs pin the loop rather than the copy: a `lessThan` test against a
LITERAL bound (3, the source's length -- both lengths are static here, so no
register is needed), a branch that leaves the loop, and the increment.

The values show the element count is the source's, not the destination's: 3 of
the 4 destination slots are written and the fourth is left alone.
*/
/* EXPECT: 1 2 3 0 */
/* EMIT: op lessThan [^ ]* [^ ]* \d+ */
/* EMIT: jump \d+ equal [^ ]* false */
/* EMIT: op add [^ ]* [^ ]* 1 */
auto device message1;
int dst[4];
int src[3] = {1, 2, 3};
void main() {
    veccpy(dst, src);
    print(dst[0]);
    print(dst[1]);
    print(dst[2]);
    print(dst[3]);
    printflush(message1);
    stop();
}
