/*
`a = b;` when both sides are arrays is a COPY, element by element -- the same
loop `veccpy(a, b)` emits, with the smaller of the two lengths as the bound.
It used to be an assignment "by reference" that copied nothing: `a[0]` read
the destination's own initial value back (0) after the assignment.

The EMITs pin the loop rather than the copy: a `lessThan` test against a
LITERAL bound (4 -- both lengths are static, so no register is needed), a
branch that leaves the loop, and the increment -- the same three shapes t153
pins for `veccpy`, because it is the same loop.
*/
/* EXPECT: 5 6 7 8 */
/* EMIT: op lessThan [^ ]* [^ ]* \d+ */
/* EMIT: jump \d+ equal [^ ]* false */
/* EMIT: op add [^ ]* [^ ]* 1 */
auto device message1;
int a[4];
int b[4] = {5, 6, 7, 8};
void main() {
    a = b;
    print(a[0]);
    print(a[1]);
    print(a[2]);
    print(a[3]);
    printflush(message1);
    stop();
}