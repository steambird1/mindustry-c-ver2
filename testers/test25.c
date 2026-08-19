#include "archon.js"

void test(content_t w) {
print(arfetch("unitCount", @crux, w, null));
  print(w);// asm("noop");
}

void test3(item_t r) {
   print(r);
}

void main() {
extern item_t w = @copper;
   test(@copper);
print(@copper);
test3(w);
}