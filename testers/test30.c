near int w[5][5];

void test(int **p) {
   int i,j; for (i = 0; i < 5; i++) for (j = 0; j < 5; j++) print(p[i][j]);
}

void main() {
   test(w);
}