/* EXPECT: 5 5 5 */
/* A function whose parameter is a TEMPLATE struct is a pattern: it is emitted
   once per variant it is called with. Assigning it to a function pointer picks
   the variant that pointer's signature spells out -- the pointer type itself
   cannot name a template, because a line number cannot say which one. */
#pragma optimize(pointer)
auto device message1;
struct tmpl { auto int *p; };
struct cvt { int *byname p; };
typedef void(*fptr)(struct cvt);
void handler(struct cvt tmp) { print(*(tmp.p)); }
void main() {
   struct tmpl m;
   extern int s;
   s = 5;
   m.p = byname(&s);
   handler(m);
   fptr z = handler;
   z(m);
   z(m);
   printflush(message1); stop();
}
