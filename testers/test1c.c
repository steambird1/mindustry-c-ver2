void main() {
   int a = 3; extern int *b;
   b = &a; (*b) = 5;
}