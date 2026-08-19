int add(int x, int y) {
   print(x,"+",y); return x+y;
}

void main() {
   extern int swtc = 1, x = 4, z = 5;
   if (swtc) {
      print(add(x,z));
   } else {
      print(add(swtc,z));
   }
}