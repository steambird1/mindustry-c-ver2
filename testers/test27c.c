void main() {
   int i;
   int j; extern int ans=0;
   for (i = 0; i < 10; i++) {
      j=i; ans+=j;
      if (i%2==0) {
         ans+=j;
      }
   }
   print(ans);
}