void main() {
   int i = 0;
   extern int ans=0;
   while (i < 10) {
      int j=5; ans+=j;
      if (i%2==0) {
         j=i; ans+=j;
      } i++;
   }
   print(ans);
}