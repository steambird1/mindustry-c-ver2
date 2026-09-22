/* EXPECT: 1 2 5 9 */
/* `auto` overloading and the struct representation together.

   `struct pt { int x; int y; }` stays in registers, so `&a` is a NAME packet,
   while `struct box` embeds an array and therefore lives in memory, so `&b` is
   a real address. One `auto` function takes either. */
#pragma overload(auto)
#pragma optimize(struct_pointer)
auto device message1;
struct pt { int x; int y; };
struct box { int arr[4]; int n; };
void setx(auto struct pt *p, int v) { p->x = v; }
void put(struct box *p, int i, int v) { p->arr[i] = v; }
void main() {
    struct pt a;
    struct pt b;
    struct box c;
    a.x = 0; a.y = 0;
    b.x = 0; b.y = 0;
    c.n = 0;
    setx(&a, 1);
    setx(&b, 2);
    print(a.x); print(b.x);
    put(&c, 0, 5);
    put(&c, 3, 9);
    print(c.arr[0]); print(c.arr[3]);
    printflush(message1); stop();
}
