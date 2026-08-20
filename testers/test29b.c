struct t {
   int q; int r;
};

struct m {
   int w[3]; struct t wu; int q[4]; struct t r; int z;
};

extern near struct m *test;

void main() {
   extern int z;
   test->q[z] = 56;
   test->r.r = 5;
}