/* EXPECT: 23 0 33 11 */
auto device message1;
int grid[3][4];
void main() {
    int i;
    int j;
    for (i = 0; i < 3; i = i + 1) {
        for (j = 0; j < 4; j = j + 1) {
            grid[i][j] = i * 10 + j;
        }
    }
    print(grid[2][3]);
    print(grid[0][0]);
    int s = 0;
    for (i = 0; i < 3; i = i + 1) {
        s = s + grid[i][1];
    }
    print(s);
    print(grid[1][1]);
    printflush(message1);
    stop();
}
