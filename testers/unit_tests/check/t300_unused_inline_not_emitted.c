/*
An uncalled inline function is dead code, exactly like an uncalled ordinary
function. It must not be emitted.

`main` calls nothing, so the call graph is empty. That used to be mistaken for
"the bodies have not been analyzed yet", which kept every uncalled inline
function -- and therefore every helper a header defines -- in the output.
*/
/* EXPECT: 1 */
/* EMIT-NOT: _unused_inline_helper */
auto device message1;

inline int unused_inline_helper(int x) {
    return x + 41;
}

void main() {
    print(1);
    printflush(message1);
    stop();
}
