void main() {
   int i;
   extern int ans=0;
   for (i = 0; i < 10; i++) {
      int j=5; ans+=j;
      if (i%2==0) {
         j=i; ans+=j;
      }
   }
   print(ans);
}