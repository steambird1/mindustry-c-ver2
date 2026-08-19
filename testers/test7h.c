struct d {
  int a; int b;
}

void proc(struct d w) {
   print(w.b);
}

void main() {
   proc({3,5});
}