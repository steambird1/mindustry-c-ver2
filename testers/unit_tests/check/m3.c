/* EXPECT: 23 14 */
/* three dimensional */
auto device message1;
int cube[2][3][4];
void main() {
    int i;
    int j;
    int k;
    int v = 0;
    for (i = 0; i < 2; i = i + 1) {
        for (j = 0; j < 3; j = j + 1) {
            for (k = 0; k < 4; k = k + 1) {
                cube[i][j][k] = v;
                v = v + 1;
            }
        }
    }
    print(cube[1][2][3]);
    print(cube[1][0][2]);
    printflush(message1);
    stop();
}
