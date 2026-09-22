/* EXPECT: 1 */
/* A remote array passed to a function: the helper the handle points at has to
   talk to the other processor, and the array's length has to come from the
   other side (it is declared `rs[]` here). */
auto device message1;
void test(remote int s[5]) { s[1] = 1; }
extern int r[5] = array("embedded_divided");
remote int rs[] = remote(@this, r);
void main() {
    test(rs);
    print(r[1]);
    printflush(message1); stop();
}
