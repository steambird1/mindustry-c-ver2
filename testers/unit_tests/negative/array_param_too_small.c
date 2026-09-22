/* Handing a 2-element array to a parameter that asks for 4. */
void test(int p[4]) { p[0] = 1; }
void main() {
    int small[2];
    test(small);
}
