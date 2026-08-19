void main() {
   extern int i;
   int j,ans=0;
   for (i = 0; i < 10; i++) {
      j=5; ans+=j;
      if (i%2==0) {
         j=i; ans+=j;
      }
   }
   print(ans);
}