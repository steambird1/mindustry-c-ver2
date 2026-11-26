/*
An uncalled ordinary function must not be emitted either, even when the call
graph is empty because `main` calls nothing. The empty graph is a legitimate
"nothing else is reachable", not a reason to skip dead-code removal.
*/
/* EXPECT: 1 */
/* EMIT-NOT: _unused_plain_helper */
auto device message1;

int unused_plain_helper(int x) {
    return x + 41;
}

void main() {
    print(1);
    printflush(message1);
    stop();
}
