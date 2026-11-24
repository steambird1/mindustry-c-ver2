/*
A function may return a shared pointer. The register pair carries the
building and offset; callers must keep the building representation instead of
running it through getlink.
*/
/* EXPECT: 3 9 */
/* EMIT: set g:\.data_block bank1 */
/* EMIT: set g:\.f:main\.b:2\.p_block g:\.f:main\.b:2\.__tempsym_ptr_0_block */
/* EMIT-NOT: getlink __curb */
#pragma noinline(get)
auto device message1;

int data[4] = {1, 2, 3, 4};

shared int *get(int i) {
    return &data[i];
}

void main() {
    print(*get(2));

    shared int *p = get(1);
    p[1] = 9;
    print(data[2]);

    printflush(message1);
    stop();
}
