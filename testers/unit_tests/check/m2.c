/* EXPECT: 7 5 */
/* runtime indices (volatile blocks constant folding) */
auto device message1;
volatile int vi;
int g[3][4];
void main() {
    int r = vi + 1;
    int c = vi + 2;
    g[r][c] = 7;
    print(g[r][c]);
    g[1][1] = 5;
    print(g[1][1]);
    printflush(message1);
    stop();
}
