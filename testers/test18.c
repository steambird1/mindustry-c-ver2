void testing(item_t* it, int* p) {
   *it = @copper; *p = 114514;
}

void main() {
   item_t stg; int val;
   testing(&stg,&val);
   print(stg,val);
}