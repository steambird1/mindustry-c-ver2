/* EXPECT: 6 0 1 2 99 6 3 2 */
/* `for` clauses may be empty, and its init may declare a variable whose
   scope is the loop's OWN (docs/OPEN_WORK.md 7.2). A declaration init
   (`for (int i = 0; ...)`) is wrapped so `i` exists for test / update /
   body and is gone afterwards: an enclosing `i` stays untouched (shadowing
   works, as in any nested block), and every clause can be dropped -- the
   empty-init form, the empty-test form, and the all-empty `for (;;)`, each
   shown here actually running and terminating. */
auto device message1;
void main() {
    /* declaration in the loop's own scope */
    int sum = 0;
    for (int i = 0; i < 4; i++) sum += i;
    print(sum);                         /* 6 */

    /* the declaration does not clobber an outer `i` */
    int i = 99;
    for (int i = 0; i < 3; i++) print(i);  /* 0 1 2 */
    print(i);                           /* 99 */

    /* empty init */
    int j = 1, prod = 1;
    for (; j <= 3; j++) prod *= j;
    print(prod);                        /* 6 */

    /* empty init and empty test */
    int k = 0, n = 0;
    for (;; k++) { if (k >= 3) break; n += k; }
    print(n);                           /* 3 */

    /* all three clauses empty */
    int m = 0;
    for (;;) { if (m >= 2) break; m++; }
    print(m);                           /* 2 */

    printflush(message1); stop();
}