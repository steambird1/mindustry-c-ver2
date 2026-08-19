int test(int x) {
   int result = 2; if (x % 2) return result; result++; return result;
}

extern int w;

void main() {
   print(test(w));
}