/*
A VLA parameter is adjusted to a pointer with runtime dimensions. The row
stride comes from the hidden length cell, not a compile-time size, and
sizeof/lenof on the parameter follow the runtime shape.
*/
/* EXPECT: 2 4 1 3 4 0 203 */
/* EMIT: set [^ ]*__vla_len_arr_0 g:\.f:foo\.sz */
/* EMIT: op mul [^ ]+ [^ ]+ g:\.f:foo\.__vla_len_arr_1 */
#include <stdint.h>
auto device message1;

void foo(int sz, int64_t arr[sz][sz + 1]) {
    for (int i = 0; i < sz; i++)
        for (int j = 0; j <= sz; j++)
            arr[i][j] = i * 100 + j;

    print(sizeof(arr));
    print(sizeof(arr[0]));
    print(sizeof(arr[0][0]));
    print(lenof(arr));
    print(lenof(arr[0]));
}

void main() {
    int64_t a[3][4];
    foo(3, a);
    print(a[0][0]);
    print(a[2][3]);
    printflush(message1);
    stop();
}
