/*
A compiler-chosen encoded array whose values form an arithmetic progression is
cheaper as a formula: `a[i] = base + i * step`. An explicit
`array("encoded", ...)` still produces the string table (see t30).
*/
/* EMIT: op add [^ ]+ [^ ]+ 78 */
/* EMIT: op mul [^ ]+ [^ ]+ 3 */
/* EMIT: op add [^ ]+ [^ ]+ 2 */
/* EMIT-NOT: read [^ ]+ "\$ */
#pragma optimize(array)
auto device message1;
volatile int i;
const int counts[13] = {78,79,80,81,82,83,84,85,86,87,88,89,90};
const int steps[5] = {2,5,8,11,14};

void main() {
    i = (int)(@time * 3.0) % 13;
    print(counts[i]);
    i = (int)(@time * 5.0) % 5;
    print(steps[i]);
    printflush(message1);
    stop();
}
