int test(int x) {
    return x+1;
}

void main() {
    extern int w;
    const int r = test(w);
    if (r == 5) print("four!");
}