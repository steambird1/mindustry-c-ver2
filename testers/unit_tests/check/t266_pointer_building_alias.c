/*
A global array that fits inside one memory block carries a known building
alias. Scalar reads and writes can address that building directly; the block
number is still the stored pointer representation, so no pointer ABI changes
are needed.
*/
/* EXPECT: 3 9 */
/* EMIT: read [^ ]+ bank1 [^ ]+ */
/* EMIT: write 9 bank1 [^ ]+ */
/* EMIT-NOT: getlink __curb */
auto device message1;
int a[4] = {1, 2, 3, 4};
volatile int i;

void main() {
    i = 2;
    print(a[i]);
    a[i] = 9;
    print(a[i]);
    printflush(message1);
    stop();
}
