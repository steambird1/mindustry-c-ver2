/* EXPECT: 7 5 7 5 7 5 7 7 5 7 3 5 6 8 6 7 4 */
/* An array with no length of its own, bound to one that has: `int s[] = r;`.
   Until now this was refused -- "the size of array 's' is neither given nor
   deducible" -- because nothing could say how long `s` was.

   It does not have to be computed, it can be TAKEN. `s` is not a copy of `r`
   and does not have storage of its own: it IS `r`, and that is what makes it
   free. The `print(mem[1])` after each write is what shows the two names reach
   one array -- a copy would print 3, and nothing at all would be printed if `s`
   had storage of its own.

   The same statement works for an array already in registers and one already
   named (`embedded_lookup`), because nothing here is about layout: the length
   was the only thing missing. `sizeof(s)` answers 5 as well, which was
   impossible for an array whose length was not written.

   Every row is a case that used to be refused outright. */
auto device message1;
void fill(int s[]) { s[2] = 8; print(lenof(s)); }
void total(int s[]) {
    int i = 0;
    int t = 0;
    while (i < 3) { t = t + s[i]; i = i + 1; }
    print(t);
}
void main() {
    int mem[5];
    int s[] = mem;
    s[1] = 7;
    print(s[1]); print(lenof(s)); print(mem[1]); print(sizeof(s));

    int div[5] = array("embedded_divided");
    int d[] = div;
    d[1] = 7;
    print(d[1]); print(lenof(d)); print(div[1]);

    int lk[5] = array("embedded_lookup");
    int k[] = lk;
    k[1] = 7;
    print(k[1]); print(lenof(k)); print(lk[1]);

    /* Two names, one array. */
    int two[5];
    int p[] = two;
    int q[] = two;
    p[1] = 3;
    print(q[1]); print(lenof(q));

    /* And a bound array is an ordinary array to hand over. */
    int six[6];
    int z[] = six;
    fill(z);
    print(six[2]);

    /* A loop over one, and a global. */
    int three[3];
    three[0] = 1;
    three[1] = 2;
    three[2] = 3;
    int w[] = three;
    total(w);

    int g[4];
    int gv[] = g;
    gv[3] = 7;
    print(g[3]); print(lenof(gv));
    printflush(message1); stop();
}
