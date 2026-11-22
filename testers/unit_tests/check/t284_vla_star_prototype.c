/*
`[*]` is allowed only in a prototype's outermost array dimension. The
definition supplies the runtime bound; the prototype itself is a pointer
parameter.
*/
/* EXPECT: 2 4 3 203 */
auto device message1;

void fill(int n, int a[*][4]);
void fill(int n, int a[n][4]) {
    for (int i = 0; i < n; i++)
        a[i][3] = i * 100 + 3;
    print(sizeof(a));
    print(sizeof(a[0]));
    print(lenof(a));
}

void main() {
    int b[3][4];
    fill(3, b);
    print(b[2][3]);
    printflush(message1);
    stop();
}
