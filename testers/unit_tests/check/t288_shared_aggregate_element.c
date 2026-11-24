/*
A shared pointer to an aggregate array element keeps the fixed-storage
building. `&big_array[1]` must not fall back to the array's numeric link id.
*/
/* EXPECT: 7 5 */
/* EMIT: set [^ ]*p_block bank1 */
/* EMIT-NOT: getlink __curb */
auto device message1;

struct Big { int a[8]; int x; };
Big data[2];

void main() {
    shared Big *p = &data[1];
    p->x = 7;
    p->a[2] = 5;
    print(p->x);
    print(p->a[2]);
    printflush(message1);
    stop();
}
