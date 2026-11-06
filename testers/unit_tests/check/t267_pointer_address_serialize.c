/*
`&a[i]` keeps the array's building-backed block while it is a temporary, but a
pointer VARIABLE still uses the numeric block ABI. The declaration must
serialize the block with the array's `_id` register.
*/
/* EXPECT: 2 3 */
/* EMIT: set g:\.a_block bank1 */
/* EMIT: set [^ ]*p_block bank1_id */
/* EMIT: set [^ ]*q_block bank1_id */
/* EMIT: getlink __curb */
auto device message1;
int a[4] = {1, 2, 3, 4};

void main() {
    int *p = &a[1];
    print(*p);
    int *q = &a[0];
    print(q[2]);
    printflush(message1);
    stop();
}
