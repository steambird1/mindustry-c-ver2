/*
The encoded correction is also folded into a comparison: `t = raw - 35`, so
`t < 9` becomes `raw < 44`. The `op sub` disappears and the branch keeps its
original meaning without a line-number repair.
*/
/* EMIT: op (lessThan|lessThanEq|greaterThan|greaterThanEq) [^ ]+ [^ ]+ 44 */
/* EMIT-NOT: op sub [^ ]+ [^ ]+ 35 */
/* EXPECT: 1 */
#pragma noinline
auto device message1;
const int b[5] = array("encoded", {1, 9, 1, 9, 8});

int below(int i) {
    return b[i] < 9;
}

void main() {
    print(below(0));
    printflush(message1);
    stop();
}
