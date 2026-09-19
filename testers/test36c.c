#pragma optimize(array)

void s(int w[3]) {
   print(w[1]);
}

void main() {
   int u[3] = {3,4,5}, *v;
   v = u + 1;
   s(u);
}