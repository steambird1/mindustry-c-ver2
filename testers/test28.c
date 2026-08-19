typedef int(*ptr)();

int a() {
  return @time;
}

ptr s[5];

struct tmp { int x; int y; };

tmp w[4];

void main() {
   w[1].x = 6;
   s[2] = a; s[3] = a; ptr tgt = s[2]; print(tgt());
}