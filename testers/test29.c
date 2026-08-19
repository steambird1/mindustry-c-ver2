struct t {
   int q; int r;
};

struct m {
   int w; struct t r; int z;
};

extern struct m *test;

void main() {
   test->r.r = 5;
}