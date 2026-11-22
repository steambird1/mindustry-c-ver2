/*
A multidimensional local VLA uses the runtime dimensions for both allocation
and row stride. sizeof/lenof answer the runtime shape.
*/
/* EXPECT: 23 12 4 3 */
auto device message1;

void main() {
    int n = 3, m = 4;
    int a[n][m];
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++)
            a[i][j] = i * 10 + j;

    print(a[2][3]);
    print(sizeof(a));
    print(sizeof(a[0]));
    print(lenof(a));
    printflush(message1);
    stop();
}
