/* EXPECT: 5 */
/* A template struct handed over BY VALUE: the copy has to keep the
   representation each member was chosen for. Copying a name-carrying member
   as a pointer wrote `p_block` / `p_pos` -- two registers that were never
   assigned -- and the copy then read through them, losing the whole point. */
#pragma optimize(pointer)
auto device message1;
struct tmpl { auto int *p; };
struct cvt { int *byname p; };
void handler(struct cvt tmp) { print(*(tmp.p)); }
void main() {
    struct tmpl m;
    extern int s;
    s = 5;
    m.p = byname(&s);
    handler(m);
    printflush(message1); stop();
}
