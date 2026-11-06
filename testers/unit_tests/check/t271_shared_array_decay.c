/*
An array decays to a shared pointer. Its building alias is known even though
the array itself is not in the native-block fast path, so the pointer keeps
bank1 directly and writes through it.
*/
/* EXPECT: 9 */
/* EMIT: set g:\.f:main\.b:1\.p_block bank1 */
/* EMIT-NOT: getlink __curb */
auto device message1;
int data[16];

void main() {
    shared int *p = data;
    p[5] = 9;
    print(p[5]);
    printflush(message1);
    stop();
}
