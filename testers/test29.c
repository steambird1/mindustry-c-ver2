struct t {
   int q; int r;
};

struct m {
   int w[3]; struct t wu; int q[4]; struct t r; int z;
};

extern struct m *test;

void main() {
   test->q[1] = 56;
   test->r.r = 5;
} 