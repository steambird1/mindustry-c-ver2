/*
`max(int,int)` and integer arithmetic are integral, even when they pass through
a float-typed expression. Converting them to int needs no `op floor`. Division
by one is exact too.

Ordinary division still needs its floor; t10 and t157 protect that behaviour.
*/
/* EXPECT: 7 3 */
/* EMIT-NOT: op floor */
#pragma noinline
auto device message1;

int bigger(int a, int b) {
    return (int)(max(a, b) * 1.0);
}

int unchanged(int a) {
    return (int)((a * 1.0) / 1);
}

void main() {
    print(bigger(3, 7));
    print(unchanged(3));
    printflush(message1);
    stop();
}
