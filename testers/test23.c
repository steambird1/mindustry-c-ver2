struct coord {
    int x; int y;
};

coord foo(int a, int b) {
    register coord tmp = {a,b};
    return tmp;
}

void main() {
    extern coord w = foo(3,4);
}